import json,uuid,secrets,urllib.request,urllib.error,sys
from pathlib import Path
url='https://ilvqopsvyacegotplstw.supabase.co'
if len(sys.argv)!=2:
 raise SystemExit('Usage: python3 scripts/backend-integration.py PRIVATE_KEY_FILE (file is deleted after testing)')
keys_path=Path(sys.argv[1])
keys=json.loads(keys_path.read_text())
admin=next(k['api_key'] for k in keys if k['name']=='service_role')
pub='sb_publishable_ZnghXbJLeZ9PbLBe-E8zMw_ekFDnuQ_'
users=[];workspace=None;owner_token=None

def call(path,body=None,token=None,key=pub,method=None):
 headers={'apikey':key,'Content-Type':'application/json'}
 if token: headers['Authorization']='Bearer '+token
 if path.startswith('/rest/'): headers['Prefer']='return=representation'
 req=urllib.request.Request(url+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=40) as response:
   raw=response.read();return response.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as error:
  raw=error.read();return error.code,json.loads(raw) if raw else None

def expect(label,status,wanted):
 if status!=wanted: raise RuntimeError(label+' returned '+str(status)+' instead of '+str(wanted))
 print('PASS: '+label)

try:
 accounts=[]
 for role in ['owner','client']:
  email='ordo-test-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_urlsafe(30)
  status,user=call('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'full_name':'Temporary '+role}},token=admin,key=admin)
  expect('temporary '+role+' account creation',status,200);users.append(user['id'])
  status,session=call('/auth/v1/token?grant_type=password',{'email':email,'password':password})
  expect(role+' password authentication',status,200)
  accounts.append({'id':user['id'],'email':email,'token':session['access_token']})
 owner,client=accounts;owner_token=owner['token']
 for fn in ['create-workspace','list-workspaces','duplicate-project','delete-workspace','generate-project-plan']:
  status,_=call('/functions/v1/'+fn,{})
  expect(fn+' rejects unauthenticated caller',status,401)
 status,result=call('/functions/v1/create-workspace',{'name':'Temporary integration test','slug':'ordo-test-'+uuid.uuid4().hex,'type':'agency'},token=owner_token)
 expect('authenticated workspace creation',status,200);workspace=result['id']
 status,result=call('/functions/v1/list-workspaces',{},token=owner_token)
 expect('authenticated workspace listing',status,200)
 assert any(w['id']==workspace for w in result['workspaces'])
 status,invites=call('/rest/v1/workspace_invitations',{'workspace_id':workspace,'email':client['email'],'role':'client','invited_by':owner['id']},token=owner_token)
 expect('owner creates client invitation',status,201);invite=invites[0]
 status,_=call('/functions/v1/accept-invitation',{'token':invite['token'],'accept':False})
 expect('token-based invitation preview with publishable key',status,200)
 status,_=call('/functions/v1/accept-invitation',{'token':invite['token'],'accept':True},token=owner_token)
 expect('invitation rejects wrong signed-in email',status,403)
 status,_=call('/functions/v1/accept-invitation',{'token':invite['token'],'accept':True},token=client['token'])
 expect('invited verified client joins workspace',status,200)
 status,_=call('/functions/v1/accept-invitation',{'token':invite['token'],'accept':True},token=client['token'])
 expect('invitation rejects replay',status,410)
 status,projects=call('/rest/v1/projects',{'workspace_id':workspace,'name':'Temporary project','owner_id':owner['id'],'status':'active'},token=owner_token)
 if status!=201: print('Project creation error:', projects.get('code'), projects.get('message'))
 expect('owner creates project',status,201);project=projects[0]['id']
 status,_=call('/rest/v1/project_members',{'workspace_id':workspace,'project_id':project,'user_id':client['id'],'role':'client'},token=owner_token)
 expect('owner grants client project access',status,201)
 status,deliverables=call('/rest/v1/deliverables',{'workspace_id':workspace,'project_id':project,'title':'Temporary review','status':'submitted','requires_approval':True,'created_by':owner['id']},token=owner_token)
 expect('owner submits deliverable',status,201)
 status,_=call('/rest/v1/rpc/review_deliverable',{'_id':deliverables[0]['id'],'_decision':'approved'},token=client['token'])
 expect('client approves shared deliverable',status,200)
 status,_=call('/functions/v1/generate-project-plan',{'workspaceId':workspace,'name':'Temporary plan','generate':{'tasks':True}},token=client['token'])
 expect('AI planning rejects client role',status,403)
 status,_=call('/functions/v1/generate-project-plan',{'workspaceId':workspace,'name':'Temporary plan','generate':{'tasks':True}},token=owner_token)
 expect('AI stays unavailable without provider credentials',status,503)
 status,_=call('/functions/v1/delete-workspace',{'workspaceId':workspace},token=client['token'])
 expect('workspace deletion rejects client',status,403)
 status,result=call('/functions/v1/duplicate-project',{'projectId':project,'name':'Temporary copy'},token=client['token'])
 expect('project duplication rejects client',status,403)
 status,result=call('/functions/v1/duplicate-project',{'projectId':project,'name':'Temporary copy'},token=owner_token)
 expect('owner duplicates project',status,200)
 print('PASS: authenticated backend integration checks complete')
finally:
 if workspace:
  status,_=call('/functions/v1/delete-workspace',{'workspaceId':workspace},token=owner_token)
  if status!=200:
   status,_=call('/rest/v1/workspaces?id=eq.'+workspace,token=admin,key=admin,method='DELETE')
  print('Cleanup workspace: '+str(status))
 for user_id in users:
  status,_=call('/auth/v1/admin/users/'+user_id,token=admin,key=admin,method='DELETE')
  print('Cleanup temporary account: '+str(status))
 keys_path.unlink(missing_ok=True)
