$response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels"
$response.tunnels[0].public_url
