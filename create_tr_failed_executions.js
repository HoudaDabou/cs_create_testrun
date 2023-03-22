const fetch = require('node-fetch');

// Common variables
const headers = {
  'accept': 'application/vnd.api+json; version=1'
};
const accessToken = 'urxaDXO0YGTl12E7P-pPpw';
const uid = 'hahadouda@gmail.com';
const clientId = 'hlTB8eEixwb0ZaQ55GPkzA';

const projectId = '112169';
const testRunId = '761578';

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
  const { testResults, buildId } = await fetchTestResults();
  const failedTests = {};
  for (const testSnapshotId in testResults) {
    if (testResults[testSnapshotId].status === 'failed') {
      const testId = testResults[testSnapshotId].snapshotId;
      console.log(testResults[testSnapshotId].status);
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
      console.log(scenarioIds);
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
        console.error(`Error: ${response.status} - ${data.errors[0].detail}`);
      } else {
        console.error(`Error: ${response.status} - ${response.statusText}`);
      }

    } catch (error) {
      console.error(error);
    }
  };

createTestRunWithFailedTests(newtestRunName, newtestRunDescription);

