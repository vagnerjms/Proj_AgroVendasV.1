import { Logger } from '@nestjs/common';

const logger = new Logger('PdfWorker');

logger.log('PDF worker placeholder started. Implement queue processing in the MVP phase that introduces async receipts.');

setInterval(() => {
  logger.debug('PDF worker heartbeat');
}, 60_000);
