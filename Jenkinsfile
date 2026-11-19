pipeline {
    agent any

    environment {
        // Tells Playwright it is running in CI (enables retries, disables test.only)
        CI = 'true'
        // Keep the MongoDB binary (~600 MB) in a fixed folder so it is downloaded only once
        MONGOMS_DOWNLOAD_DIR = 'D:/tools/mongodb-binaries'
    }

    options {
        // Abort the build if it takes longer than 20 minutes
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {
        stage('Checkout app under test') {
            steps {
                // Clone Julio's app into a subfolder called "app" (read-only, public repo)
                dir('app') {
                    git url: 'https://github.com/juliodelimas/browserstack-lab.git', branch: 'main'
                }
            }
        }

        stage('Install app') {
            steps {
                dir('app') {
                    bat 'npm ci'
                }
            }
        }

        stage('Start app') {
            steps {
                // Start the app in the background and save its output to log files
                powershell '''
                    $appDir = Join-Path $env:WORKSPACE 'app'
                    $log = Join-Path $env:WORKSPACE 'app.log'
                    # Launch through cmd.exe so the app is fully detached from the Jenkins step
                    Start-Process -FilePath 'cmd.exe' -ArgumentList "/c npm start > $log 2>&1" -WorkingDirectory $appDir -WindowStyle Hidden
                '''
                // Wait until the API and the web app answer (max 10 minutes)
                powershell '''
                    $deadline = (Get-Date).AddMinutes(10)
                    foreach ($url in @('http://localhost:3001/api/products', 'http://localhost:3000')) {
                        while ($true) {
                            try {
                                Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 | Out-Null
                                Write-Host "UP: $url"
                                break
                            } catch {
                                if ((Get-Date) -gt $deadline) { throw "App did not start in time: $url" }
                                Start-Sleep -Seconds 2
                            }
                        }
                    }
                '''
            }
        }

        stage('Install tests') {
            steps {
                bat 'npm ci'
                bat 'npx playwright install chromium'
            }
        }

        stage('Run E2E tests') {
            steps {
                bat 'npx playwright test'
            }
        }
    }

    post {
        always {
            // Test results chart in Jenkins
            junit allowEmptyResults: true, testResults: 'results/junit.xml'
            // Keep the HTML report and the app logs as downloadable files
            archiveArtifacts artifacts: 'playwright-report/**, app*.log', allowEmptyArchive: true
            // Stop the app: kill whatever is listening on ports 3000 and 3001
            powershell '''
                Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue |
                    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
            '''
        }
    }
}
