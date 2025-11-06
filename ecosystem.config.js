// PM2 Ecosystem Configuration for Digital Ocean
module.exports = {
  apps: [{
    name: 'prokrishi-backend',
    script: './index.js',
    instances: 1, // Use 'max' for cluster mode or number for specific instances
    exec_mode: 'fork', // 'cluster' for load balancing or 'fork' for single instance
    watch: false, // Set to true for development, false for production
    max_memory_restart: '1G', // Restart if memory exceeds 1GB
    env: {
      NODE_ENV: 'development',
      PORT: 3500
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3500
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true, // Prepend timestamp to logs
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // Advanced options
    node_args: '--max-old-space-size=1024', // Limit memory usage
    ignore_watch: [
      'node_modules',
      'logs',
      '.git',
      '*.log'
    ]
  }]
};

