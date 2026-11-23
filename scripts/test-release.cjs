// Offline release gate. No SQL, live requests, fixture uploads, or database changes.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const separate=new Map([['test-acl-preparation.cjs','ACL rollback-generator/snapshot preparation; no ACL or SQL changes in this release.'],['test-crud-schema-preparation.cjs','Schema/rollback preparation; no migration or schema changes in this release.']]);
const tests=fs.readdirSync(path.join(__dirname)).filter(n=>/^test-.*\.cjs$/.test(n)&&n!=='test-release.cjs').sort();let passed=0;
for(const test of tests){if(separate.has(test)){console.log('NOT RUN (separate database-preparation suite): '+test+' — '+separate.get(test));continue;}const r=spawnSync(process.execPath,[path.join(__dirname,test)],{cwd:path.join(__dirname,'..'),stdio:'inherit',windowsHide:true});if(r.status!==0){console.error('FAIL release gate: '+test);process.exit(r.status||1);}passed++;}
console.log('PASS release application regressions: '+passed+'; database-preparation suites not run: '+separate.size+'.');
