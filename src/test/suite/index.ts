import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000 // 10 second timeout for async operations
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        try {
            // Discover test files
            const testFiles = globSync('**/**.test.js', { cwd: testsRoot });
            
            // Add files to the test suite
            testFiles.forEach(file => {
                mocha.addFile(path.resolve(testsRoot, file));
            });

            // Run the mocha test
            mocha.run((failures: number) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
} 