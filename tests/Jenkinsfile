pipeline {
    agent any

    environment {
        // Tells Playwright it is running in CI (enables retries, disables test.only)
        CI = 'true'
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
                    Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $appDir `
                        -RedirectStandardOutput (Join-Path $env:WORKSPACE 'app.log') `
                        -RedirectStandardError (Join-Path $env:WORKSPACE 'app-error.log') `
                        -WindowStyle Hidden
                '''
                // Wait until the API and the web app answer (max 3 minutes)
                powershell '''
                    $deadline = (Get-Date).AddMinutes(3)
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
