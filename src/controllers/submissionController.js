const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Judge0 API URL - use your hosted instance or RapidAPI
const JUDGE0_URL = process.env.JUDGE0_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY; // Required for RapidAPI

// Language IDs for Judge0
const LANGUAGE_IDS = {
  c: 50,
  cpp: 54,
  javascript: 63,
  python: 71,
  java: 62,
  ruby: 72,
  typescript: 74,
  go: 60,
  rust: 73,
};

// Helper to read test file for an exercise
const getTestFile = (track, category, exerciseSlug, dataPath) => {
  const exercisePath = path.join(
    dataPath,
    track,
    "exercises",
    category,
    exerciseSlug
  );

  // Try different test file patterns
  const testPatterns = [
    `${exerciseSlug.replace(/-/g, "_")}_test.${getExtension(track)}`,
    `test_${exerciseSlug.replace(/-/g, "_")}.${getExtension(track)}`,
    `${exerciseSlug}.spec.js`,
    `${exerciseSlug}.test.js`,
    `test_${exerciseSlug}.py`,
    `${exerciseSlug}_test.rb`,
  ];

  for (const pattern of testPatterns) {
    const testPath = path.join(exercisePath, pattern);
    if (fs.existsSync(testPath)) {
      return fs.readFileSync(testPath, "utf8");
    }
  }

  // Check in .meta folder
  const metaTestPath = path.join(exercisePath, ".meta", "tests.toml");
  if (fs.existsSync(metaTestPath)) {
    return fs.readFileSync(metaTestPath, "utf8");
  }

  return null;
};

// Get file extension for track
const getExtension = (track) => {
  const extensions = {
    c: "c",
    cpp: "cpp",
    javascript: "js",
    python: "py",
    java: "java",
    ruby: "rb",
    typescript: "ts",
    go: "go",
    rust: "rs",
  };
  return extensions[track] || "txt";
};

// Helper to get header file for C/C++
const getHeaderFile = (track, category, exerciseSlug, dataPath) => {
  if (track !== "c" && track !== "cpp") return null;

  const exercisePath = path.join(
    dataPath,
    track,
    "exercises",
    category,
    exerciseSlug
  );
  const headerName = `${exerciseSlug.replace(/-/g, "_")}.h`;
  const headerPath = path.join(exercisePath, headerName);

  if (fs.existsSync(headerPath)) {
    return fs.readFileSync(headerPath, "utf8");
  }
  return null;
};

// Parse test cases from test file
const parseTestCases = (testContent, track) => {
  const testCases = [];

  if (!testContent) {
    return [
      {
        input: "",
        expectedOutput: "Test file not found",
        description: "No tests",
      },
    ];
  }

  // JavaScript/TypeScript test parsing (Jest/Mocha style)
  if (track === "javascript" || track === "typescript") {
    const testRegex =
      /(?:test|it)\s*\(\s*['"`](.+?)['"`].*?expect\s*\(.*?\)\.(?:toBe|toEqual|toStrictEqual)\s*\(\s*(.+?)\s*\)/gs;
    let match;
    while ((match = testRegex.exec(testContent)) !== null) {
      testCases.push({
        description: match[1],
        expectedOutput: match[2].replace(/['"]/g, ""),
        input: match[1],
      });
    }
  }

  // Python test parsing
  if (track === "python") {
    const testRegex = /def\s+test_(\w+).*?assert.*?==\s*(.+)/gs;
    let match;
    while ((match = testRegex.exec(testContent)) !== null) {
      testCases.push({
        description: match[1].replace(/_/g, " "),
        expectedOutput: match[2].trim(),
        input: match[1],
      });
    }
  }

  // Ruby test parsing
  if (track === "ruby") {
    const testRegex =
      /(?:def\s+test_|it\s+['"])(\w+).*?assert_equal\s+(.+?),/gs;
    let match;
    while ((match = testRegex.exec(testContent)) !== null) {
      testCases.push({
        description: match[1].replace(/_/g, " "),
        expectedOutput: match[2].trim(),
        input: match[1],
      });
    }
  }

  // C/C++ test parsing (Unity framework)
  if (track === "c" || track === "cpp") {
    const testRegex =
      /TEST_ASSERT_EQUAL(?:_\w+)?\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/gs;
    let match;
    while ((match = testRegex.exec(testContent)) !== null) {
      testCases.push({
        description: `Test: ${match[2]}`,
        expectedOutput: match[1].trim(),
        input: match[2],
      });
    }
  }

  // Fallback: return at least one test case
  if (testCases.length === 0) {
    testCases.push({
      description: "Run tests",
      expectedOutput: "Tests should pass",
      input: "submission",
    });
  }

  return testCases;
};

// Build complete source code for submission
const buildSourceCode = (userCode, testContent, headerContent, track) => {
  let fullCode = "";

  if (track === "c" || track === "cpp") {
    // For C/C++, include header and user code, then test
    if (headerContent) {
      fullCode += `// Header file\n${headerContent}\n\n`;
    }
    fullCode += `// User solution\n${userCode}\n\n`;
    if (testContent) {
      fullCode += `// Tests\n${testContent}\n`;
    }
  } else if (track === "javascript" || track === "typescript") {
    // For JS/TS, user code first, then tests
    fullCode = `${userCode}\n\n// Tests\n${testContent || ""}`;
  } else if (track === "python") {
    fullCode = `${userCode}\n\n# Tests\n${testContent || ""}`;
  } else if (track === "ruby") {
    fullCode = `${userCode}\n\n# Tests\n${testContent || ""}`;
  } else {
    fullCode = userCode;
  }

  return fullCode;
};

// Submit to Judge0
const submitToJudge0 = async (sourceCode, languageId, stdin = "") => {
  const headers = {
    "Content-Type": "application/json",
  };

  // Add RapidAPI headers if using RapidAPI
  if (JUDGE0_API_KEY) {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
    headers["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com";
  }

  try {
    // Create submission
    const createResponse = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin,
      },
      { headers }
    );

    return createResponse.data;
  } catch (error) {
    console.error("Judge0 error:", error.response?.data || error.message);
    throw new Error("Failed to run code on Judge0");
  }
};

// Main submission handler
const submitCode = async (req, res) => {
  try {
    const { track, category, exerciseSlug, sourceCode, languageId } = req.body;
    const dataPath = path.join(__dirname, "..", "data");

    // Validate inputs
    if (!track || !category || !exerciseSlug || !sourceCode) {
      return res.status(400).json({
        error:
          "Missing required fields: track, category, exerciseSlug, sourceCode",
      });
    }

    // Get test file and header (for C/C++)
    const testContent = getTestFile(track, category, exerciseSlug, dataPath);
    const headerContent = getHeaderFile(
      track,
      category,
      exerciseSlug,
      dataPath
    );

    // Parse test cases for result display
    const testCases = parseTestCases(testContent, track);

    // Build full source code
    const fullCode = buildSourceCode(
      sourceCode,
      testContent,
      headerContent,
      track
    );

    // Get language ID
    const langId = languageId || LANGUAGE_IDS[track] || 63;

    // Submit to Judge0
    const result = await submitToJudge0(fullCode, langId);

    // Parse Judge0 response
    const status = result.status?.description || "Unknown";
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const compileOutput = result.compile_output || "";
    const time = result.time || "0";
    const memory = result.memory || 0;

    // Determine if passed based on status and output
    // Status ID 3 = Accepted
    const isAccepted = result.status?.id === 3;
    const hasError = stderr || compileOutput;
    const passed = isAccepted && !hasError;

    // Build test results
    const testResults = testCases.map((tc, index) => ({
      input: tc.input || `Test ${index + 1}`,
      expectedOutput: tc.expectedOutput || "Pass",
      actualOutput: passed ? "Pass" : stderr || compileOutput || status,
      passed: passed,
    }));

    // const submission = await Submission.create({ ... });

    res.json({
      message: passed ? "All tests passed!" : "Some tests failed",
      submission: {
        _id: result.token || Date.now().toString(),
        result: {
          status: status,
          stdout: stdout,
          stderr: stderr,
          compileOutput: compileOutput,
          time: time,
          memory: memory,
        },
        passed: passed,
        testResults: testResults,
      },
    });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({
      error: error.message || "Submission failed",
      submission: {
        _id: Date.now().toString(),
        result: {
          status: "Error",
          stdout: null,
          stderr: error.message,
          compileOutput: null,
          time: "0",
          memory: 0,
        },
        passed: false,
      },
    });
  }
};

module.exports = {
  submitCode,
};
