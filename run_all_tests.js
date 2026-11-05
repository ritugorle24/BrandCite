import { runExactChecks } from './lib/exactChecks';

(async () => {
  // Seed data matching the test suite
  const terms = [
    { id: '1', term: 'guys', type: 'banned', replacement: 'everyone', rule_id: 'R-TERM-05' } as any,
    // add any other terms used in the test suite if needed
  ];
  const rules = [
    { id: 'R-CLAIM-02', category: 'claims', text: '' } as any,
  ];
  const text = 'Our product is 100% guaranteed and never fails. Guys, check it.';
  const findings = await runExactChecks(text, terms, rules);
  if (findings.length !== 4) {
    console.error('❌ Expected 4 findings, got', findings.length);
    console.error(findings);
    process.exit(1);
  }
  console.log('✅ All checks passed – 4 findings as expected');
})();
