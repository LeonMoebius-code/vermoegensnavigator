const { writeFileSync } = require('node:fs');
const { relative } = require('node:path');

class BrowserEvidence {
  cases = [];
  results = [];

  onBegin(_config, suite) {
    this.cases = suite.allTests().map(test => ({
      id: test.id,
      project: test.parent.project().name,
      file: relative(process.cwd(), test.location.file),
      title: test.titlePath().slice(3),
      expected: test.expectedStatus,
    }));
  }

  onTestEnd(test, result) {
    this.results.push({ id: test.id, expected: test.expectedStatus, status: result.status });
  }

  onEnd({ status }) {
    writeFileSync(process.env.CI_BROWSER_REPORT, JSON.stringify({
      cases: this.cases,
      results: this.results,
      status,
    }), { flag: 'wx' });
  }
}

module.exports = BrowserEvidence;
