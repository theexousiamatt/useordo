import { afterEach, describe, expect, it } from 'vitest';
import { authPath, authReturnPath, forgetInvitation, rememberInvitation, safeReturnPath } from './authReturn';
afterEach(() => sessionStorage.clear());
describe('invitation auth context', () => {
 it.each(['https://example.com','//example.com','/\\example.com','/auth\n/invite'])('rejects unsafe return paths %s', value => expect(safeReturnPath(value)).toBe('/'));
 it('keeps a nested invitation through signup, recovery and reload', () => {
   const path='/auth/invite?token=sample&join=1'; rememberInvitation(path);
   const reset=authPath('/auth/forgot-password',path,'client@example.com');
   expect(authReturnPath(new URLSearchParams(reset.split('?')[1]))).toBe(path);
   expect(authReturnPath(new URLSearchParams())).toBe(path);
   forgetInvitation(); expect(authReturnPath(new URLSearchParams())).toBe('/');
 });
});
