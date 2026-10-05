import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, 'contracts', 'FlashArbExecutor.sol');
const source = fs.readFileSync(sourcePath, 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'FlashArbExecutor.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    metadata: { bytecodeHash: 'none' },
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const diagnostics = output.errors ?? [];
const errors = diagnostics.filter((item) => item.severity === 'error');
for (const diagnostic of diagnostics) process.stderr.write(`${diagnostic.formattedMessage}\n`);
if (errors.length > 0) process.exit(1);

const contract = output.contracts?.['FlashArbExecutor.sol']?.FlashArbExecutor;
if (!contract?.evm?.bytecode?.object) throw new Error('FlashArbExecutor bytecode was not produced');

const artifact = {
  contractName: 'FlashArbExecutor',
  sourceName: 'contracts/FlashArbExecutor.sol',
  compilerVersion: '0.8.24',
  optimizerRuns: 200,
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
  deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
};

const artifactPath = path.join(projectRoot, 'src', 'engine', 'FlashArbExecutor.json');
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
process.stdout.write(`Compiled FlashArbExecutor: ${artifact.bytecode.length / 2 - 1} bytes\n`);
process.stdout.write(`Artifact: ${path.relative(projectRoot, artifactPath)}\n`);
