import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def test_view_endpoint():
    ip = "192.168.8.164"
    username = "cimi"
    password = "Automatizador2026*"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(ip, username=username, password=password, timeout=10)
    except Exception as e:
        print(f"Error al conectar por SSH: {e}")
        return

    cmd = """node -e "
    const http = require('http');
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/ades/view/6630',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log('Status code for ID 6630:', res.statusCode);
        console.log('Headers:', res.headers);
        process.exit(0);
    });

    req.on('error', (e) => {
        console.error('Request error:', e.message);
        process.exit(1);
    });

    req.end();
    " """

    stdin, stdout, stderr = ssh.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    print(stderr.read().decode('utf-8'))

    ssh.close()

if __name__ == "__main__":
    test_view_endpoint()
