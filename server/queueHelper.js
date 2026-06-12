async function callNextWaitingUser(prisma, lineClient, targetDate, excludeQueueId = null) {
  try {
    const whereClause = {
      status: 'WAITING',
      targetDate: targetDate
    };
    if (excludeQueueId) {
      whereClause.id = { not: excludeQueueId };
    }

    const nextQueue = await prisma.queue.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'asc' }
    });

    if (nextQueue) {
      await prisma.queue.update({
        where: { id: nextQueue.id },
        data: { status: 'CALLED', calledAt: new Date() }
      });

      if (lineClient && nextQueue.lineUserId) {
        try {
          await lineClient.pushMessage({
            to: nextQueue.lineUserId,
            messages: [{
              type: 'text',
              text: `順番が来ましたので店舗へお越しください。\n（受付番号: ${nextQueue.dailyNumber}）`
            }]
          });
        } catch (err) {
          console.error("Failed to send LINE message for auto-call:", err);
        }
      }
    }
  } catch (err) {
    console.error("Error in callNextWaitingUser:", err);
  }
}

async function handleCancelAndRequeue(prisma, lineClient, queueId) {
  const queue = await prisma.queue.findUnique({ where: { id: parseInt(queueId) } });
  if (!queue) return null;

  // Mark original as CANCELED
  await prisma.queue.update({
    where: { id: queue.id },
    data: { status: 'CANCELED' }
  });

  // Get max dailyNumber for today
  const maxQueue = await prisma.queue.findFirst({
    where: { targetDate: queue.targetDate },
    orderBy: { dailyNumber: 'desc' }
  });
  const nextDailyNumber = maxQueue ? maxQueue.dailyNumber + 1 : 1;

  // Create new WAITING queue
  const newQueue = await prisma.queue.create({
    data: {
      lineUserId: queue.lineUserId,
      displayName: queue.displayName,
      targetDate: queue.targetDate,
      status: 'WAITING',
      dailyNumber: nextDailyNumber,
      cancelCount: queue.cancelCount + 1
    }
  });

  // Notify user about re-queue
  if (lineClient && queue.lineUserId) {
    try {
      let messageText = `お呼び出しから一定時間経過したため、最後尾にて再受付いたしました。\n新たな受付番号は『${newQueue.dailyNumber}番』です。`;
      
      if (queue.status === 'IN_STORE') {
        messageText = `申し訳ございません。査定のご案内のためお呼び出しいたしましたが、いらっしゃらなかったようなので一度キャンセルとさせていただきました。\n再度査定希望の場合は、お手数ですが店内スタッフにお声がけください。`;
      }

      await lineClient.pushMessage({
        to: queue.lineUserId,
        messages: [{
          type: 'text',
          text: messageText
        }]
      });
    } catch (err) {
      console.error("Failed to send LINE message for requeue:", err);
    }
  }

  // Auto-call next waiting user for the same date, but exclude the newly created queue
  await callNextWaitingUser(prisma, lineClient, queue.targetDate, newQueue.id);

  return newQueue;
}

module.exports = { callNextWaitingUser, handleCancelAndRequeue };
