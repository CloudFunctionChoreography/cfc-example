'use strict';
const cfc = require(`cfc-lib`);

module.exports.hello = (event, context, callback) => {
    if (event.workflowState || event.hintMessage) {
        const options = {
            functionExecutionId: context.awsRequestId,
            stateProperties: {
                cloudWatchLogGroupName: context.logGroupName,
                cloudWatchLogStreamName: context.logStreamName,
                cfcReceiveTime: (new Date().getTime() - (30000 - context.getRemainingTimeInMillis()))
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
        cfc.executeWorkflowStep(event, options,context, handler).then(handlerResult => {
            callback(null, {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({handlerResult})
            });
        }).catch(reason => {
                console.error(reason);
                callback(reason, null);
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
    let waitTill = new Date(new Date().getTime() + 500);
    while (waitTill > new Date()) {
    }
    return {success: `true`};
}