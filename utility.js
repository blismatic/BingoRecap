import { readFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import exec from 'child_process';
import path from 'node:path';

const inputDir = './resources/bosses';
const outputDir = './resources/bosses';

if (!existsSync(outputDir)) {
    mkdirSync(outputDir);
}

readdirSync(inputDir).forEach(file => {
    if (path.extname(file).toLowerCase() === '.png') {
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, file);

        const cmd = `ffmpeg -y -i "${inputPath}" -vf "scale=w=100:h=100:force_original_aspect_ratio=decrease:flags=neighbor,pad=100:100:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -frames:v 1 -update 1 "${outputPath}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error processing ${file}:`, error.message);
            } else {
                console.log(`Resized ${file}`);
            }
        });
    }
});