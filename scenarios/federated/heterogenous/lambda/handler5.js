'use strict';
const cfc = require(`cfc-lib`);
const gaussian = require('gaussian');


module.exports.hello = (event, context, callback) => {
    if (event.workflowState || event.hintMessage) {
        const remainingTime = context.getRemainingTimeInMillis();
        const executionTimeLimit = 5000;
        const options = {
            functionExecutionId: context.awsRequestId,
            stateProperties: {
                cloudWatchLogGroupName: context.logGroupName,
                cloudWatchLogStreamName: context.logStreamName,
                cfcReceiveTime: (new Date().getTime() - (5000 - context.getRemainingTimeInMillis())),
                initDuration: executionTimeLimit - remainingTime
            },
            workflowsLocation: process.env.workflowsLocation,
            security: {
                openWhisk: {
                    owApiAuthKey: process.env.owApiAuthKey,
                    owApiAuthPassword: process.env.owApiAuthPassword
                },
                awsLambda: {
                    accessKeyId: process.env.awsAccessKeyId,
                    secretAccessKey: process.env.awsSecretAccessKey
                }
            }
        };
        cfc.executeWorkflowStep(event, options, context, handler).then(handlerResult => {
            callback(null, {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({handlerResult})
            });
        }).catch(reason => {
                console.error(reason);
                // callback(reason, null);
				callback(null, reason);
            }
        );
    } else {
        let handlerResult = handler(event);
        const response = {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({handlerResult})
        };
        callback(null, response);
    }
};

function handler(event, context) {
    const meanSleepTime = 400;
    const standardDeviation = 26;
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
}