import { copyFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, expect } from '../fixtures';
import {
  EN_CREATED_DATE_HEADER,
  EN_EXPIRATION_DATE_HEADER,
  createUserViaForm,
  editAltaCell,
  expectCreatedThenExpiration,
  headerTexts,
  openPositions,
  postPosition,
} from '../helpers/user-positions';

const execFileAsync = promisify(execFile);

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });

test.afterEach(async ({ page }, testInfo) => {
  await page.close();
  const video = page.video();
  if (!video) {
    return;
  }
  const src = await video.path();
  await mkdir('test-results', { recursive: true });
  const webm = 'test-results/admin-positions-review.webm';
  await copyFile(src, webm);
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      webm,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      'test-results/admin-positions-review.mp4',
    ]);
  } catch {
    testInfo.annotations.push({ type: 'note', description: `ffmpeg skipped; kept ${webm}` });
  }
});

test('User Positions tab review video records Alta then Baja', async ({
  page,
  request,
  createdResources,
}) => {
  const { id } = await createUserViaForm(page, 'e2evid');
  createdResources.push({ collection: 'users', id });
  await postPosition(request, id, { createdDate: '2010-06-01T00:00:00.000Z' });
  await openPositions(page, id);
  await editAltaCell(page, '1995-03-15');
  await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('form-save').click();
  const headers = await headerTexts(page);
  expectCreatedThenExpiration(headers, EN_CREATED_DATE_HEADER, EN_EXPIRATION_DATE_HEADER);
});
