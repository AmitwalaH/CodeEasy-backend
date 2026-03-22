import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import {
  http,
  getRuntime,
  findExerciseDir,
  readMetaConfig,
  applySlugPattern,
  parseTestLines,
  errorSubmission,
} from "./common.js";

async function findPhpFiles(exerciseDir, slug) {
  const meta = await readMetaConfig(exerciseDir);
  const pascal = slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join("");

  let solution = `${pascal}.php`;
  let test = `${pascal}Test.php`;

  if (meta?.files?.solution?.length) {
    solution = applySlugPattern(slug, meta.files.solution[0]);
  }
  if (meta?.files?.test?.length) {
    test = applySlugPattern(slug, meta.files.test[0]);
  }

  return { solution, test, testPath: path.join(exerciseDir, test) };
}

function extractPhpTestMethods(testContent) {
  if (!testContent) return [];
  const methods = [];
  const re =
    /public\s+function\s+(test\w+)\s*\(\s*\)\s*(?::\s*\w+\s*)?\{([\s\S]*?)(?=\n\s{4}(?:public|protected|private|\/\*\*|#\[)|\n\})/g;
  let m;
  while ((m = re.exec(testContent)) !== null) {
    let body = m[2];
    body = body.replace(/\s*\}\s*$/, "").trim();
    methods.push({ name: m[1], body });
  }
  return methods;
}

function convertBody(body) {
  let b = body;
  b = b.replace(/\$this->assertEquals\s*\(/g, "_eq(");
  b = b.replace(/\$this->assertSame\s*\(/g, "_eq(");
  b = b.replace(/\$this->assertEqualsCanonicalizing\s*\(/g, "_eqc(");
  b = b.replace(/\$this->assertTrue\s*\(/g, "_ok(");
  b = b.replace(/\$this->assertFalse\s*\(/g, "_no(");
  b = b.replace(/\$this->assertNull\s*\(/g, "_null(");
  b = b.replace(/\$this->assertNotNull\s*\(/g, "_notnull(");
  b = b.replace(/\$this->assertCount\s*\(/g, "_cnt(");
  b = b.replace(/\$this->assertContains\s*\(/g, "_has(");
  b = b.replace(/\$this->assertStringContainsString\s*\(/g, "_str(");
  b = b.replace(/\$this->assertMatchesRegularExpression\s*\(/g, "_rx(");
  b = b.replace(/\$this->assertEqualsWithDelta\s*\(/g, "_delta(");
  b = b.replace(/\$this->assertGreaterThan\s*\(/g, "_gt(");
  b = b.replace(/\$this->assertGreaterThanOrEqual\s*\(/g, "_gte(");
  b = b.replace(/\$this->assertLessThan\s*\(/g, "_lt(");
  b = b.replace(/\$this->assertLessThanOrEqual\s*\(/g, "_lte(");
  b = b.replace(/\$this->assertIsArray\s*\(/g, "_isarr(");
  b = b.replace(/\$this->assertIsString\s*\(/g, "_isstr(");
  b = b.replace(/\$this->assertIsInt\s*\(/g, "_isint(");
  b = b.replace(/\$this->assertIsBool\s*\(/g, "_isbool(");
  b = b.replace(/\$this->assertIsFloat\s*\(/g, "_isfloat(");
  b = b.replace(/\$this->assertEmpty\s*\(/g, "_empty(");
  b = b.replace(/\$this->assertNotEmpty\s*\(/g, "_notempty(");
  b = b.replace(/\$this->expectException\s*\(/g, "_extype(");
  b = b.replace(/\$this->expectExceptionMessage\s*\(/g, "_exmsg(");
  b = b.replace(/\$this->markTestSkipped\s*\(/g, "_skip(");
  return b;
}

function buildTestCode(testMethods) {
  const lines = [];
  lines.push(`$GLOBALS["f"]=0;`);
  lines.push(`function _eq($e,$a,$m=""){if($e!==$a)throw new Exception(($m?"$m: ":"")."Expected ".json_encode($e)." got ".json_encode($a));}`);
  lines.push(`function _eqc($e,$a,$m=""){$s=function($x){$r=[];foreach($x as $i){$r[]=json_encode($i);}sort($r);return $r;};if($s($e)!==$s($a))throw new Exception("Expected ".json_encode($e)." got ".json_encode($a));}`);
  lines.push(`function _ok($a,$m=""){if(!$a)throw new Exception($m?$m:"Expected true");}`);
  lines.push(`function _no($a,$m=""){if($a)throw new Exception($m?$m:"Expected false");}`);
  lines.push(`function _null($a,$m=""){if($a!==null)throw new Exception("Expected null got ".json_encode($a));}`);
  lines.push(`function _notnull($a,$m=""){if($a===null)throw new Exception("Expected not null");}`);
  lines.push(`function _cnt($e,$a,$m=""){$c=count($a);if($c!==$e)throw new Exception("Expected count $e got $c");}`);
  lines.push(`function _has($n,$h,$m=""){if(!in_array($n,$h))throw new Exception("Expected to contain ".json_encode($n));}`);
  lines.push(`function _str($n,$h,$m=""){if(strpos($h,$n)===false)throw new Exception("Expected string to contain ".json_encode($n));}`);
  lines.push(`function _rx($p,$s,$m=""){if(!preg_match($p,$s))throw new Exception("Expected to match $p");}`);
  lines.push(`function _delta($e,$a,$d,$m=""){if(abs($e-$a)>$d)throw new Exception("Expected $e got $a");}`);
  lines.push(`function _gt($e,$a,$m=""){if(!($a>$e))throw new Exception("Expected >$e");}`);
  lines.push(`function _gte($e,$a,$m=""){if(!($a>=$e))throw new Exception("Expected >=$e");}`);
  lines.push(`function _lt($e,$a,$m=""){if(!($a<$e))throw new Exception("Expected <$e");}`);
  lines.push(`function _lte($e,$a,$m=""){if(!($a<=$e))throw new Exception("Expected <=$e");}`);
  lines.push(`function _isarr($a,$m=""){if(!is_array($a))throw new Exception("Expected array");}`);
  lines.push(`function _isstr($a,$m=""){if(!is_string($a))throw new Exception("Expected string");}`);
  lines.push(`function _isint($a,$m=""){if(!is_int($a))throw new Exception("Expected int");}`);
  lines.push(`function _isbool($a,$m=""){if(!is_bool($a))throw new Exception("Expected bool");}`);
  lines.push(`function _isfloat($a,$m=""){if(!is_float($a))throw new Exception("Expected float");}`);
  lines.push(`function _empty($a,$m=""){if(!empty($a))throw new Exception("Expected empty");}`);
  lines.push(`function _notempty($a,$m=""){if(empty($a))throw new Exception("Expected not empty");}`);
  lines.push(`function _extype($c){}`);
  lines.push(`function _exmsg($m){}`);
  lines.push(`function _skip($m=""){throw new Exception("SKIP:".$m);}`);
  lines.push(``);

  if (testMethods.length > 0) {
    for (const method of testMethods) {
      const testName = method.name
        .replace(/^test_?/, "")
        .replace(/_/g, " ")
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();

      const body = convertBody(method.body);

      lines.push(`try{`);
      lines.push(body);
      lines.push(`echo "TEST: ${testName} - PASS ok".PHP_EOL;`);
      lines.push(`}catch(Throwable $e){`);
      lines.push(`$msg=$e->getMessage();`);
      lines.push(`if(strpos($msg,"SKIP:")===0){`);
      lines.push(`echo "TEST: ${testName} - SKIP".PHP_EOL;`);
      lines.push(`}else{`);
      lines.push(`echo "TEST: ${testName} - FAIL xx".PHP_EOL;`);
      lines.push(`echo "  Error: ".$msg.PHP_EOL;`);
      lines.push(`$GLOBALS["f"]++;`);
      lines.push(`}}`);
      lines.push(``);
    }
  } else {
    lines.push(`try{`);
    lines.push(`$r=helloWorld();`);
    lines.push(`if($r!=="Hello, World!")throw new Exception("Expected Hello, World! got ".$r);`);
    lines.push(`echo "TEST: say hi - PASS ok".PHP_EOL;`);
    lines.push(`}catch(Throwable $e){`);
    lines.push(`echo "TEST: say hi - FAIL xx".PHP_EOL;`);
    lines.push(`echo "  Error: ".$e->getMessage().PHP_EOL;`);
    lines.push(`$GLOBALS["f"]++;`);
    lines.push(`}`);
  }

  lines.push(`exit($GLOBALS["f"]>0?1:0);`);
  return lines.join("\n");
}

export async function runPhp({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  try {
    const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
    if (!exerciseDir) return errorSubmission("Exercise not found");

    const rt = await getRuntime("php");
    if (!rt?.version) return errorSubmission("PHP runtime not found");

    const { solution, test, testPath } = await findPhpFiles(
      exerciseDir,
      exerciseSlug
    );

    let testContent = "";
    if (fsSync.existsSync(testPath)) {
      testContent = await fs.readFile(testPath, "utf8");
    }

    const testMethods = extractPhpTestMethods(testContent);

    const cleanUserCode = String(userCode || "")
      .replace(/<\?php/gi, "")
      .replace(/<\?/g, "")
      .trim();

    const testCode = buildTestCode(testMethods);

    // Everything inlined into single file - no require_once
    const mainPhp = `<?php\n${cleanUserCode}\n${testCode}`;

    console.log("=== PHP RUNNER ===");
    console.log("Exercise:", exerciseSlug);
    console.log("Runtime:", rt.version);
    console.log("Test methods:", testMethods.length);
    console.log("Total size:", Buffer.byteLength(mainPhp, "utf8"), "bytes");
    console.log("=== MAIN (first 300 chars) ===");
    console.log(mainPhp.slice(0, 300));

    const files = [
      { name: "main.php", content: mainPhp },
    ];

    const payload = {
      language: "php",
      version: String(rt.version),
      files,
      stdin: stdin || "",
    };

    const r = await http.post("/execute", payload);
    const out = r.data;

    const stdout = out.run?.stdout || "";
    const stderr = out.run?.stderr || "";
    const exitCode = out.run?.code ?? 0;

    console.log("=== PHP OUTPUT ===");
    console.log("stdout:", stdout);
    console.log("stderr:", stderr);
    console.log("code:", exitCode);

    if (stderr && (stderr.includes("Parse error") || stderr.includes("Fatal error"))) {
      return {
        success: true,
        submission: {
          result: {
            status: "Compilation Error",
            stdout: "",
            stderr: stderr,
            compileOutput: stderr,
            time: "0",
            memory: 0,
          },
          passed: false,
          testResults: [{
            input: "Compilation",
            expectedOutput: "Success",
            actualOutput: "Failed",
            passed: false,
          }],
        },
      };
    }

    const testResults = parseTestLines(stdout);
    if (testResults.length === 0) {
      testResults.push({
        input: "Execution",
        expectedOutput: "Success",
        actualOutput: exitCode === 0 ? "Success" : "Failed",
        passed: exitCode === 0,
      });
    }

    const allPassed = testResults.every((t) => t.passed);

    return {
      success: true,
      submission: {
        result: {
          status: allPassed ? "Accepted" : "Wrong Answer",
          stdout,
          stderr,
          compileOutput: null,
          time: ((out.run?.time || 0) / 1000).toFixed(3),
          memory: out.run?.memory || 0,
        },
        passed: allPassed,
        testResults,
      },
    };
  } catch (e) {
    console.error("=== PHP RUNNER ERROR ===", e?.message);
    return errorSubmission(e?.message || "PHP runner failed");
  }
}