function formatDateJp(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  }
  return dateStr;
}

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
          const now = new Date();
          const deadline = new Date(now.getTime() + 30 * 60000);
          const deadlineStr = new Intl.DateTimeFormat('ja-JP', { 
            timeZone: 'Asia/Tokyo', 
            hour: '2-digit', 
            minute: '2-digit' 
          }).format(deadline);

          await lineClient.pushMessage({
            to: nextQueue.lineUserId,
            notificationDisabled: false,
          messages: [{
              type: 'text',
              text: `【2.ご来店依頼】\n順番が来ましたので店舗へお越しください。\n${deadlineStr} までに店にお戻りいただき、スタッフへ「受付番号(整理券番号)」をお伝えください。\n\n[${formatDateJp(nextQueue.targetDate)}]`
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

  if (queue.cancelCount >= 1) {
    // Hard cancel for 2nd time cancel, no requeue
    if (lineClient && queue.lineUserId) {
      try {
        await lineClient.pushMessage({
          to: queue.lineUserId,
          notificationDisabled: false,
          messages: [{
            type: 'text',
            text: `誠に恐れ入りますが、再度お呼び出ししてもいらっしゃらなかったため、本日の受付を完全にキャンセルとさせていただきました。\n再度査定をご希望の場合は、お手数ですが最初から受付をお願いいたします。\n\n[${formatDateJp(queue.targetDate)}]`
          }]
        });
      } catch (err) {
        console.error("Failed to send LINE message for hard cancel:", err);
      }
    }
    
    // Auto-call next waiting user for the same date
    await callNextWaitingUser(prisma, lineClient, queue.targetDate);
    return queue;
  }

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
      let messageText = `お呼び出しから一定時間経過したため、最後尾にて再受付いたしました。\n新たな受付番号(整理券番号)は『${newQueue.dailyNumber}番』です。\n\n[${formatDateJp(newQueue.targetDate)}]`;
      
      await lineClient.pushMessage({
        to: queue.lineUserId,
        notificationDisabled: false,
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

module.exports = { callNextWaitingUser, handleCancelAndRequeue, formatDateJp };
