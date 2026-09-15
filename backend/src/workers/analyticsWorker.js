require("dotenv").config();

const { Worker } = require("bullmq");

const connection = require("../queues/queueConnection");
const { recordClickEvent } = require("../repositories/urlRepository");

const worker = new Worker(
  "analytics",
  async (job) => {
    if (job.name !== "click") {
      throw new Error(`Unsupported analytics job: ${job.name}`);
    }

    await recordClickEvent(job.data);
  },
  {
    connection,
    concurrency: Number(process.env.ANALYTICS_WORKER_CONCURRENCY) || 5
  }
);

worker.on("completed", (job) => {
  console.log(`Analytics job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Analytics job failed: ${job ? job.id : "unknown"}`, error);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down analytics worker...`);
  await worker.close();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

console.log("Analytics worker is running");