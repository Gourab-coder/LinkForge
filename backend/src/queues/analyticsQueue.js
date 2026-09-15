const { Queue } = require("bullmq");

const connection = require("./queueConnection");

let analyticsQueue;

function getAnalyticsQueue() {
	if (!analyticsQueue) {
		analyticsQueue = new Queue("analytics", {
			connection,
			defaultJobOptions: {
				attempts: Number(process.env.ANALYTICS_JOB_ATTEMPTS) || 3,
				backoff: {
					type: "exponential",
					delay: Number(process.env.ANALYTICS_JOB_BACKOFF_MS) || 1000
				},
				removeOnComplete: {
					age: 3600,
					count: 1000
				},
				removeOnFail: {
					age: 86400,
					count: 5000
				}
			}
		});
	}

	return analyticsQueue;
}

async function enqueueClickEvent(event) {
	return getAnalyticsQueue().add("click", event, { jobId: event.eventId });
}

async function closeAnalyticsQueue() {
	if (analyticsQueue) await analyticsQueue.close();
}

module.exports = { enqueueClickEvent, closeAnalyticsQueue };
