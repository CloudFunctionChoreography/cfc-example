'use strict';

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const cloudwatchlogs = new AWS.CloudWatchLogs();
const json2xls = require('json2xls');
const fs = require('file-system');

const getWorkflowStateLogs = (offset, logGroupName, callbackFn, stateLogs, nextToken) => {
    const stateParams = {
        endTime: new Date().getTime(),
        filterPattern: '"LOG_WORKFLOW_STATE:"',
        interleaved: false, //If the value is true, the operation makes a best effort to provide responses that contain events from multiple log streams within the log group, interleaved in a single response. If the value is false, all the matched log events in the first log stream are searched first, then those in the next log stream, and so on. The default is false
        limit: 10000,
        startTime: new Date().getTime() - (offset),
        logGroupName: logGroupName
    };
    if (nextToken) stateParams.nextToken = nextToken;

    cloudwatchlogs.filterLogEvents(stateParams, (workflowStateErr, workflowStateData) => {
        if (workflowStateErr) console.error(workflowStateErr, workflowStateErr.stack); // an error occurred
        else {
            let newStateLogs = [...stateLogs, ...workflowStateData.events];

            if (workflowStateData.nextToken) {
                getWorkflowStateLogs(offset, logGroupName, callbackFn, newStateLogs, workflowStateData.nextToken)
            } else {
                callbackFn(newStateLogs);
            }
        } // successful response
    });
};

const getWorkflowMetricLogs = (offset, logGroupName, callbackFn, metricLogs, nextToken) => {
    const metricParams = {
        logGroupName: logGroupName, /* required */
        interleaved: false, //If the value is true, the operation makes a best effort to provide responses that contain events from multiple log streams within the log group, interleaved in a single response. If the value is false, all the matched log events in the first log stream are searched first, then those in the next log stream, and so on. The default is false
        limit: 10000,
        endTime: new Date().getTime(),
        startTime: new Date().getTime() - (offset),
        filterPattern: `"REPORT"`
    };
    if (nextToken) metricParams.nextToken = nextToken;

    cloudwatchlogs.filterLogEvents(metricParams, (reportErr, reportData) => {
        if (reportErr) console.error(reportErr, reportErr.stack); // an error occurred
        else {
            let newMetricLogs = [...metricLogs, ...reportData.events];

            if (reportData.nextToken) {
                getWorkflowMetricLogs(offset, logGroupName, callbackFn, newMetricLogs, reportData.nextToken)
            } else {
                callbackFn(newMetricLogs);
            }
        } // successful response
    });
};

let storeTestname = "";
const collectAwsWorkflowLogs = (logsPerMinute, offset, testname) => {

    storeTestname = testname
    if (logsPerMinute > 10000) {
        console.error("Log limit exceeded!!!");
        return "Log limit exceeded!!!";
    } else {
        const logGroupNames = ['/aws/lambda/public-cloud-dev-function1',
            '/aws/lambda/public-cloud-dev-function2',
            '/aws/lambda/public-cloud-dev-function3',
            '/aws/lambda/public-cloud-dev-function4'];

        let counter = 0;
        for (let logGroupName of logGroupNames) {
            setTimeout(() => {
                console.log(`Start getting AWS logs for ${logGroupName}`);
                getWorkflowStateLogs(offset, logGroupName, (stateLogs) => {
                    getWorkflowMetricLogs(offset, logGroupName, (metricLogs) => {
                        let promises = [];
                        for (let i = 0; i < stateLogs.length; i++) {
                            if (stateLogs[i].message.includes("LOG_WORKFLOW_STATE:")) {
                                let metricLog;
                                for (let j = 0; j < metricLogs.length; j++) {
                                    let requestId = metricLogs[j].message.split("RequestId: ")[1].split("\t")[0];
                                    if (requestId === stateLogs[i].message.split("\t")[1]) {
                                        metricLog = metricLogs[j]
                                    }
                                }

                                if (!metricLog) {
                                    console.error(`No metrics found for ${JSON.stringify(stateLogs[i])}`)
                                } else {
                                    promises.push(persistAwsLambdaActivation(stateLogs[i], metricLog))
                                }
                            }
                        }

                        Promise.all(promises).then(logs => {
                            let xls = json2xls(logs);

                            let location = `benchmark/stepLogs/step_log_aws_function_${logGroupName.split('function')[1]}.xlsx`
                            if (storeTestname !== "") location = `benchmark/${storeTestname}/stepLogs/step_log_aws_function_${logGroupName.split('function')[1]}.xlsx`
                            fs.writeFileSync(location, xls, 'binary');
                            console.log(`+++++++++++++++++ Added ${logs.length} new log entries to xls: ${location} ++++++++++++++++++`)
                        })
                    }, [])
                }, [])
            }, counter * 10000);
            counter++;
        }
    }
};

const persistAwsLambdaActivation = (activationLog, metricLog) => {
    return new Promise((resolve, reject) => {
        if (activationLog.message.includes("LOG_WORKFLOW_STATE:") && !(activationLog.message.includes("START") || activationLog.message.includes("END") || activationLog.message.includes("REPORT"))) {

            let splitEventMessageTab = activationLog.message.split("\t");
            let splitEventMessageState = splitEventMessageTab[2].split("LOG_WORKFLOW_STATE:");
            let functionRequestId = splitEventMessageTab[1];
            let logWorkflowState = Object.assign(JSON.parse(splitEventMessageState[1]));
            let historyItem;
            for (let item of logWorkflowState.excutionHistory) {
                if (item.step === logWorkflowState.currentStep) {
                    historyItem = item;
                    break;
                }
            }

            if (!historyItem) {
                reject('No history item found for current step')
            } else {
                let maxMemoryUsed = metricLog.message.split("Max Memory Used: ")[1].split(" MB")[0];
                let memorySize = metricLog.message.split("Memory Size: ")[1].split(" MB")[0];
                let billedDuration = metricLog.message.split("Billed Duration: ")[1].split(" ms")[0];
                let duration = Number(metricLog.message.split("Duration: ")[1].split(" ms")[0]);
                let executionDuration = duration - historyItem.stateProperties.initDuration;

                let log = {
                    executionUuid: logWorkflowState.executionUuid,
                    functionRequestId: functionRequestId,
                    billedDuration: billedDuration,
                    cfcReceiveTime: historyItem.stateProperties.cfcReceiveTime,
                    coldExecution: historyItem.stateProperties.coldExecution ? 1 : 0,
                    context: logWorkflowState.excutionHistory[0].stateProperties.context,
                    initDuration: historyItem.stateProperties.initDuration,
                    executionDuration: executionDuration,
                    duration: historyItem.stateProperties.initDuration + executionDuration,
                    faasDuration: duration,
                    functionInstanceId: historyItem.stateProperties.functionInstanceUuid,
                    maxMemoryUsed: maxMemoryUsed,
                    provider: historyItem.provider,
                    step: historyItem.step,
                    memorySize: memorySize,
                    // logWorkflowState: logWorkflowState,
                    optimizationMode: logWorkflowState.optimizationMode,
                };
                resolve(log);
            }
        } else {
            reject("No workflow to log")
        }
    });
};

exports.collectAwsWorkflowLogs = collectAwsWorkflowLogs;
