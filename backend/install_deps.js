const { exec } = require('child_process');
const pwd = 'Aut0m4t1z4d0r2026%*';
const command = `echo '${pwd}' | sudo -S dnf install -y atk at-spi2-atk at-spi2-core libXcomposite libXcursor libXdamage libXext libXfixes libXi libXrandr libXrender libXtst alsa-lib mesa-libgbm pango cairo libxshmfence nss nspr libdrm libxkbcommon`;

console.log("Starting installation of Puppeteer dependencies...");
exec(command, (err, stdout, stderr) => {
    console.log("=== ERROR ===");
    console.log(err);
    console.log("=== STDOUT ===");
    console.log(stdout);
    console.log("=== STDERR ===");
    console.log(stderr);
});
