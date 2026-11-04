CREATE SCHEMA foundation_test;
CREATE FUNCTION foundation_test.assert(_condition boolean,_message text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 IF _condition IS NOT TRUE THEN RAISE EXCEPTION 'Assertion failed: %',_message; END IF;
END $$;
CREATE FUNCTION foundation_test.expect_error(_sql text,_state text,_message text) RETURNS void
LANGUAGE plpgsql AS $$ DECLARE actual text; BEGIN
 BEGIN EXECUTE _sql;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
  IF actual<>_state THEN RAISE EXCEPTION 'Wrong error for %: expected %, received % (%)',_message,_state,actual,SQLERRM; END IF;
  RETURN;
 END;
 RAISE EXCEPTION 'Expected error for %',_message;
END $$;
GRANT USAGE ON SCHEMA foundation_test TO anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA foundation_test TO anon,authenticated,service_role;
