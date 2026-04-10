BEGIN;
SELECT plan(1);
SELECT ok(true, 'pgTAP is working');
SELECT * FROM finish();
ROLLBACK;
