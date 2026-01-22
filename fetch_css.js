const { exec } = require('child_process');
const fs = require('fs');

exec('git show 1dc0f76:styles.css', { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    fs.writeFileSync('styles_old_clean.css', stdout, 'utf8');
    console.log('Successfully wrote styles_old_clean.css');
});
