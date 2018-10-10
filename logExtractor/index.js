const openWhiskExtractor = require('./openWhiskExtractor');
const awsWorkflowExtractor = require('./awsWorkflowExtractor');
const awsHintExtractor = require('./awsHintExtractor');

let testname = "";
if (process.argv[2]) {
    testname = process.argv[2]
}

const startAt = 60000 * 20;
let logsPerMinute = 2400;
awsWorkflowExtractor.collectAwsWorkflowLogs(logsPerMinute, startAt, testname);
awsHintExtractor.collectAwsHintLogs(logsPerMinute, startAt, testname);
openWhiskExtractor.collectOpenWhiskLogs(logsPerMinute, startAt, testname);


