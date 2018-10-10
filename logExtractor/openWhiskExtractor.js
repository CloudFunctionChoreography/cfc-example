'use strict';

const json2xls = require('json2xls');
const fs = require('file-system');
const openwhisk = require('openwhisk');
const ow = openwhisk({
    apihost: 'openwhisk.eu-gb.bluemix.net',
    namespace: 'simon.buchholz@campus.tu-berlin.de_dev',
    api_key: '735bf87f-b685-4dad-a705-b6e48e006cb3:FSRxx0LxHC0ibdttIylmH2O20R5TIaIi3FVnm6uej2aiYO8y8APMelNYcbuh88OC'
});
const now = new Date().getTime();

const actionNames = ['action1Handler',
    'action2Handler',
    'action3Handler',
    'action4Handler',
    'action5Handler'
];

const timeout = 10;
let storeTestname = "";

const collectLogs = (actionName, startAt) => {
    // 1. Get all activation ids
    const getAllActivationsPromise = () => {
        return new Promise((resolve, reject) => {
            let since = now - startAt;
            console.log(`Start getting OW logs for ${actionName}, since ${since}, upto ${now}`);
            let allActivations = [];
            const recursiveCallback = () => {
                let upto = since + 8000;
                collectOpenWhiskLogsForAction(actionName, since, upto).then(activations => {
                    allActivations = [...allActivations, ...activations];
                    since += 8000;
                    if (since < now) {
                        setTimeout(() => {
                            recursiveCallback();
                        }, timeout);
                    } else {
                        resolve(allActivations)
                    }
                }).catch(error => {
                    reject(error);
                });
            };
            recursiveCallback();
        });
    };

    // 2. Get activation details for all activation ids
    const getActivationsPromise = () => {
        return new Promise((resolve, reject) => {
            getAllActivationsPromise().then(allActivations => {
                let detailedActionActivations = [];
                console.log(`${detailedActionActivations.length} activations processed for ${actionName}`);
                let logInterval = setInterval(() => {
                    console.log(`${detailedActionActivations.length} activations processed for ${actionName}`);
                }, 30000);
                const recursiveCallback = () => {
                    let activation = allActivations.pop();
                    if (activation) {
                        getSingleAction(activation.activationId, 0).then(singleActivation => {
                            detailedActionActivations.push(singleActivation);
                            setTimeout(() => {
                                recursiveCallback();
                            }, timeout);
                        }).catch(reason => {
                            clearInterval(logInterval);
                            reject(reason)
                        })
                    } else {
                        clearInterval(logInterval);
                        resolve(detailedActionActivations)
                    }
                };
                recursiveCallback();
            }).catch(reason => {
                reject(reason)
            });
        });
    };

    // 3. Transform activation details and store them in xlsx
    return new Promise((resolve, reject) => {
        getActivationsPromise().then(detailedActionActivations => {
            let stepLogResults = [];
            let hintLogResults = [];
            for (let activation of detailedActionActivations) {
                let transformedLog = transformLogs(activation);
                if (transformedLog && transformedLog.stepLog) stepLogResults.push(transformedLog.stepLog);
                else if (transformedLog && transformedLog.hintLog) hintLogResults.push(transformedLog.hintLog);
            }

            let xlsStepLogs = json2xls(stepLogResults);
            let location = `benchmark/stepLogs/step_log_openWhisk_${actionName}.xlsx`;
            if (storeTestname !== "") location = `benchmark/${storeTestname}/stepLogs/step_log_openWhisk_${actionName}.xlsx`;
            fs.writeFileSync(location, xlsStepLogs, 'binary');
            console.log(`+++++++++++++++++ Added ${stepLogResults.length} new log entries to xls: ${location} ++++++++++++++++++`);


            let xlsHintLogs = json2xls(hintLogResults);
            let location2 = `benchmark/hintLogs/hint_log_openWhisk_${actionName}.xlsx`;
            if (storeTestname !== "") location2 = `benchmark/${storeTestname}/hintLogs/hint_log_openWhisk_${actionName}.xlsx`;
            fs.writeFileSync(location2, xlsHintLogs, 'binary');
            console.log(`+++++++++++++++++ Added ${hintLogResults.length} new log entries to xls: ${location2} ++++++++++++++++++`)
            resolve(`Logs for ${actionName} stored`)
        }).catch(reason => {
            reject(reason)
        })
    });
};

const collectOpenWhiskLogsForAction = (actionName, since, upto) => {
    return new Promise((resolve, reject) => {
        ow.activations.list({
            name: actionName,
            since: since,
            upto: upto,
            limit: 200
        }).then(activationsList => {
            if (activationsList.length >= 200) console.warn("activation list length too long");
            resolve(activationsList)
        }).catch(error => {
            reject(error)
        });
    })
};

const getSingleAction = (activationId) => {
    return new Promise((resolve, reject) => {
        ow.activations.get({
            activationId: activationId
        }).then(result => {
            resolve(result)
        }).catch(error => {
            reject(error)
        })
    })
};

const transformLogs = (activation) => {
    for (let log of activation.logs) {
        if (log.includes("LOG_WORKFLOW_STATE:")) {
            let logWorkflowState = JSON.parse(log.split("LOG_WORKFLOW_STATE:")[1]);

            let historyItem;
            for (let item of logWorkflowState.excutionHistory) {
                if (item.step === logWorkflowState.currentStep) {
                    historyItem = item;
                    break;
                }
            }

            if (!historyItem) {
                console.error('No history item found for current step')
                return null;
            } else {
                let waitTime = 0;
                let initTime = 0;
                let memorySize = -1;
                const annotations = activation.annotations;
                annotations.forEach(annotation => {
                    if (annotation.key === "limits") {
                        memorySize = annotation.value.memory;
                    } else if (annotation.key === "waitTime") {
                        waitTime = annotation.value
                    } else if (annotation.key === "initTime") {
                        initTime = annotation.value
                    }
                });

                let duration = Number(activation.duration);
                const initDuration = waitTime + initTime;
                const executionDuration = duration - initTime;
                let actionActivationId = activation.activationId;
                let billedDuration = false;
                let maxMemoryUsed = false;
                let coldExecution = historyItem.stateProperties.coldExecution ? 1 : 0;
                let activationLog = {
                    executionUuid: logWorkflowState.executionUuid,
                    functionRequestId: actionActivationId,
                    billedDuration: billedDuration,
                    cfcReceiveTime: historyItem.stateProperties.cfcReceiveTime,
                    coldExecution: coldExecution,
                    context: logWorkflowState.excutionHistory[0].stateProperties.context,
                    initDuration: initDuration,
                    executionDuration: duration - initTime,
                    duration: executionDuration + initDuration,
                    faasDuration: duration, // duration measured by the faas system (in ow this excludes the waittime)
                    functionInstanceId: historyItem.stateProperties.functionInstanceUuid,
                    maxMemoryUsed: maxMemoryUsed,
                    provider: historyItem.provider,
                    step: historyItem.step,
                    memorySize: memorySize,
                    // logWorkflowState: logWorkflowState,
                    optimizationMode: logWorkflowState.optimizationMode,
                };

                return {stepLog: activationLog};
            }
        } else if (log.includes("LOG_WORKFLOW_HINT:")) {
            let logHintObject = JSON.parse(log.split("LOG_WORKFLOW_HINT:")[1]);
            let triggeredFrom = logHintObject.triggeredFrom;
            delete logHintObject.triggeredFrom;


            let duration = Number(activation.duration);
            let memorySize = activation.annotations[0].value.memory; // TODO does not always work because annotations is different for activations
            let billedDuration = false;
            let maxMemoryUsed = false;

            let activationLog = {
                billedDuration: billedDuration,
                duration: duration,
                maxMemoryUsed: maxMemoryUsed,
                memorySize: memorySize,
                triggeredFromFunctionExecutionId: triggeredFrom.functionExecutionId,
                triggeredFromFunctionInstanceUuid: triggeredFrom.functionInstanceUuid,
                triggeredFromStep: triggeredFrom.step,
                recursiveHintCounter: logHintObject.recursiveHintCounter
            };

            return {hintLog: Object.assign(logHintObject, activationLog)};

        }
    }
};



const collectOpenWhiskLogs = (logsPerMinute, startAt, testname) => {
    storeTestname = testname;

    const recursiveCallback = () => {
        let actionName = actionNames.pop();
        if (actionName) {
            collectLogs(actionName, startAt).then(result => {
                // console.log(result);
                recursiveCallback();
            }).catch(reason => {
                console.error(reason);
                recursiveCallback();
            })
        }
    };
    recursiveCallback();
};

exports.collectOpenWhiskLogs = collectOpenWhiskLogs;