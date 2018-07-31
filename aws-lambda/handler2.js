'use strict';
const cfc = require(`cfc-lib`);

module.exports.hello = (event, context, callback) => {
    if (event.workflowState) {
        const workflowsLocation = process.env.workflowsLocation;
        const stateProperties = {
            cloudWatchLogGroupName: context.logGroupName,
            cloudWatchLogStreamName: context.logStreamName
        };
        cfc.executeWorkflowStep(event, context.awsRequestId, stateProperties, workflowsLocation, handler).then(handlerResult => {
            callback(null, {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Go Serverless v1.0! Your function executed successfully!',
                    input: handlerResult,
                }),
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
            body: JSON.stringify({
                message: 'Go Serverless v1.0! Your function executed successfully!',
                input: handlerResult,
            }),
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