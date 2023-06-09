const fetch = require('node-fetch');

// Common variables
const headers = {
  'accept': 'application/vnd.api+json; version=1'
};
const accessToken = '<your access token>';
const uid = '<your uid>';
const clientId = '<your client id>';

const projectId = '<your project ID>';
const testRunId = '<your test run ID>';

const now = new Date();
const dateString = now.toISOString().split('T')[0]; // get the date string in the format YYYY-MM-DD
const newtestRunName = `Failed test results extracted from test run ID: ${testRunId} - on ${dateString}`; // set the name variable
const newtestRunDescription = `This test run is based on failed test results extracted from test run ID: ${testRunId} - on ${dateString}`; // set the description variable

const fetchTestResults = async () => {
    const response = await fetch(`https://studio.cucumber.io/api/projects/${projectId}/test_runs/${testRunId}/builds/current?include=test-results`, {
      headers: { ...headers, 'access-token': accessToken, 'uid': uid, 'client': clientId }
    });
    const { data, included } = await response.json();
    const testResultsBySnapshotId = included.reduce((acc, testResult) => {
      const snapshotId = testResult.relationships['test-snapshot'].data.id;
      if (!acc[snapshotId]) {
        acc[snapshotId] = [];
      }
      acc[snapshotId].push({
        snapshotId,
        testResultId: testResult.id,
        status: testResult.attributes.status
      });
      return acc;
    }, {});
    const testResults = Object.values(testResultsBySnapshotId).flat();
    return testResults;
  };
  
// Step 2: Extract tests with "failed" status
const extractFailedTests = async () => {
  const testResults = await fetchTestResults();
  const failedTests = {};
  for (const testSnapshotId in testResults) {
    if (testResults[testSnapshotId].status === 'failed') {
      const testId = testResults[testSnapshotId].snapshotId;
      if (!failedTests[testId]) {
        const response = await fetch(`https://studio.cucumber.io/api/projects/${projectId}/test_runs/${testRunId}/test_snapshots/${testId}?include=scenario`, {
          headers: { ...headers, 'access-token': accessToken, 'uid': uid, 'client': clientId }
        });
        const data = await response.json();
        failedTests[testId] = {
          scenarioId: data.data.relationships['scenario'].data.id,
          testResults: []
        };
      }
      failedTests[testId].testResults.push({
        testSnapshotId,
      });
    }
  }
  return failedTests;
};

// Step 3: Create a new test run
const createTestRunWithFailedTests = async (name, description) => {
    try {
      const failedTests = await extractFailedTests();
      if (Object.keys(failedTests).length === 0) {
        console.log(`No failed tests found in the current build of test run ID: ${testRunId}`);
        return;
      }
      const scenarioIds = Object.values(failedTests).map((test) => test.scenarioId);
      const testRunData = {
        data: {
          attributes: {
            name: name,
            description: description,
            scenario_ids: scenarioIds,
          },
        },
      };
      const response = await fetch(
        `https://studio.cucumber.io/api/projects/${projectId}/test_runs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/vnd.api+json; version=1',
            'access-token': accessToken,
            uid: uid,
            client: clientId,
          },
          body: JSON.stringify(testRunData),
        }
      );
      const data = await response.json();
    //   console.log(`New test run created with ID: ${data.data.id}`);
    if (response.ok) {
        console.log(`New test run created with ID: ${data.data.id}`);
      } else if (response.status === 422) {
        console.log(`A test run with this name "${newtestRunName}" already exists`);
      } else {
        console.error(`Error: ${response.status} - ${response.statusText}`);
      }

    } catch (error) {
      console.error(error);
    }
  };

createTestRunWithFailedTests(newtestRunName, newtestRunDescription);
