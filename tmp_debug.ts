import { runExactChecks } from './lib/exactChecks';

(async () => {
  const text = 'Our product is 100% guaranteed and never fails. Guys, check it.';
  const terms = [{ id: '1', term: 'guys', type: 'banned', replacement: 'everyone', rule_id: 'R-TERM-05' }];
  const rules = [{ id: 'R-CLAIM-02', category: 'claims', text: '' }];
  const findings = await runExactChecks(text, terms, rules);
  console.log('Findings count:', findings.length);
  console.log(findings.map(f => ({ issue: f.issue, quote: f.quote })));
})();
