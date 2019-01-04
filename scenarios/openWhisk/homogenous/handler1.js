'use strict';

// TODO: Open issue in OpenWhisk: https://github.com/apache/incubator-openwhisk-runtime-nodejs/issues/57
const dirname = __dirname;
const cfc = require(`cfc-lib`);
const gaussian = require('gaussian');


/**
 * Entry point to the action. It either executes the OpenWhisk action as a step in a defined workflow, or
 * as a usual action invocation.
 * @param params
 * @returns {*}
 */
function hello(params) {
    return new Promise((resolve, reject) => {
        let cfcParams
        try { // workflow initialization is passed as http post request
            cfcParams = {
                workflowState: JSON.parse(params.__ow_body).workflowState,
                hintMessage: JSON.parse(params.__ow_body).hintMessage,
                context: JSON.parse(params.__ow_body).context
            }
        } catch (e) { // workflow initialization is passed as api request
            cfcParams = {
                workflowState: params.workflowState,
                hintMessage: params.hintMessage,
                context: params.context
            }
        }

        if (cfcParams.workflowState || cfcParams.hintMessage) {
            const workflowsLocation = `${dirname}${params.workflowsLocation}`;
            const options = {
                functionExecutionId: process.env.__OW_ACTIVATION_ID,
                stateProperties: {context: cfcParams.context, cfcReceiveTime: (process.env.__OW_DEADLINE - 60000)},
                workflowsLocation: workflowsLocation,
                security: {
                    openWhisk: {
                        owApiAuthKey: params.owApiAuthKey,
                        owApiAuthPassword: params.owApiAuthPassword
                    },
                    awsLambda: {
                        accessKeyId: params.awsAccessKeyId,
                        secretAccessKey: params.awsSecretAccessKey
                    }
                }
            };
            cfc.executeWorkflowStep(cfcParams, options, process.env, handler).then(handlerResult => {
                resolve(handlerResult);
            }).catch(reason => {
                reject(reason);
            });
        } else {
            resolve(handler(params));
        }
    });
}

/**
 *
 * @param params
 * @returns Either an object or a promise that later resolves an object
 */
function handler(params) {
    const meanSleepTime = 500;
    const standardDeviation = 32;
    const variance = standardDeviation * standardDeviation;
    const distribution = gaussian(meanSleepTime, variance);
    // Take a random sample using inverse transform sampling method.
    let sleepTime = distribution.ppf(Math.random());

	
    while (sleepTime < 0 ) {
        sleepTime = distribution.ppf(Math.random());
    }

	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve({success: `true`});
		}, sleepTime);
    });
    

    /*Alternative:
    return {success: `true`};
	*/
}

exports.hello = hello;
