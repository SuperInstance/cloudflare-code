/**
 * Stack Trace Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { StackTraceParser, Language as LangEnum } from './stack-trace';

describe('StackTraceParser', () => {
  const parser = new StackTraceParser();

  describe('JavaScript Stack Traces', () => {
    it('should parse V8 stack trace', () => {
      const stackTrace = `
Error: Test error
    at Object.method (/path/to/file.js:10:15)
    at Module.exports (/another/file.js:25:8)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
      `.trim();

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace).toBeDefined();
      expect(result.trace?.frames.length).toBeGreaterThan(0);
      expect(result.trace?.language).toBe(LangEnum.JAVASCRIPT);
    });

    it('should parse stack trace with column numbers', () => {
      const stackTrace = `Error: Test
    at method (/path/file.js:10:15)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.frames[0]).toMatchObject({
        filePath: '/path/file.js',
        lineNumber: 10,
        columnNumber: 15,
      });
    });

    it('should detect async frames', () => {
      const stackTrace = `Error: Async error
    at async function (/path/file.js:10:15)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.asyncFrames.length).toBeGreaterThan(0);
    });

    it('should identify library frames', () => {
      const stackTrace = `Error: Test
    at appMethod (/src/app.js:10:15)
    at libraryMethod (/node_modules/lib/index.js:25:8)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.appFrames.length).toBeGreaterThan(0);
      expect(result.trace?.libraryFrames.length).toBeGreaterThan(0);
    });
  });

  describe('Python Stack Traces', () => {
    it('should parse Python traceback', () => {
      const stackTrace = `
Traceback (most recent call last):
  File "test.py", line 10, in <module>
    raise ValueError("Test error")
  File "module.py", line 5, in function
    pass
      `.trim();

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.language).toBe(LangEnum.PYTHON);
      expect(result.trace?.frames.length).toBeGreaterThan(0);
    });

    it('should extract line numbers correctly', () => {
      const stackTrace = `Traceback (most recent call last):
  File "test.py", line 42, in test_function
    raise Error()`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.frames[0].lineNumber).toBe(42);
    });
  });

  describe('Java Stack Traces', () => {
    it('should parse Java stack trace', () => {
      const stackTrace = `
Exception in thread "main" java.lang.NullPointerException
    at com.example.Class.method(Class.java:42)
    at com.example.Another.method(Another.java:10)
    at java.lang.Thread.run(Thread.java:748)
      `.trim();

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.language).toBe(LangEnum.JAVA);
      expect(result.trace?.frames.length).toBeGreaterThan(0);
    });

    it('should parse class and method names', () => {
      const stackTrace = `Exception in thread "main" java.lang.Error
    at com.example.Class.method(Class.java:42)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.frames[0].className).toBe('com.example.Class');
      expect(result.trace?.frames[0].functionName).toBe('method');
    });
  });

  describe('Go Stack Traces', () => {
    it('should parse Go stack trace', () => {
      const stackTrace = `
goroutine 1 [running]:
main.main()
        /path/to/file.go:10 +0x123
created by main.main
        /path/to/file.go:5 +0x45
      `.trim();

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.language).toBe(LangEnum.GO);
    });
  });

  describe('Ruby Stack Traces', () => {
    it('should parse Ruby backtrace', () => {
      const stackTrace = `
TestError: Test error
    from /path/to/file.rb:10:in \`method1\'
    from /path/to/file.rb:5:in \`method2\'
      `.trim();

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.language).toBe(LangEnum.RUBY);
    });
  });

  describe('C# Stack Traces', () => {
    it('should parse C# stack trace', () => {
      const stackTrace = `
System.NullReferenceException: Object reference not set
   at Class.Method() in C:\\Path\\File.cs:line 42
   at Class.AnotherMethod() in C:\\Path\\Another.cs:line 10
      `.trim();

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.language).toBe(LangEnum.CSHARP);
    });
  });

  describe('Rust Stack Traces', () => {
    it('should parse Rust backtrace', () => {
      const stackTrace = `
thread panicked at \'assertion failed: x == y\', lib.rs:10:5
stack backtrace:
   0: rust_begin_unwind
             at rust/library/std/src/panicking.rs:584:5
   1: core::panicking::panic_fmt
             at rust/library/core/src/panicking.rs:142:14
   2: my_crate::module::function
             at src/lib.rs:10:5
      `.trim();

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.language).toBe(LangEnum.RUST);
    });
  });

  describe('Root Cause Detection', () => {
    it('should identify root cause frame', () => {
      const stackTrace = `Error: Test
    at libraryMethod (/node_modules/lib/index.js:5:10)
    at appMethod (/src/app.js:42:15)
    at anotherAppMethod (/src/other.js:20:8)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);
      expect(result.trace?.rootCauseFrame).toBeDefined();
      // Root cause should be the first app frame
      expect(result.trace?.rootCauseFrame?.isApp).toBe(true);
    });
  });

  describe('Frame Statistics', () => {
    it('should calculate frame statistics', () => {
      const stackTrace = `Error: Test
    at appMethod1 (/src/app1.js:10:15)
    at appMethod2 (/src/app2.js:20:8)
    at libMethod (/node_modules/lib/index.js:5:10)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);

      const stats = parser.getStats(result.trace!);
      expect(stats.totalFrames).toBe(3);
      expect(stats.appFrames).toBe(2);
      expect(stats.libraryFrames).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty stack trace', () => {
      const result = parser.parse('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle unknown language', () => {
      const result = parser.parse('Some random text that is not a stack trace');

      // Should still parse something
      expect(result).toBeDefined();
    });

    it('should handle malformed stack traces', () => {
      const stackTrace = `Error: Test
    at invalid frame format
    at another invalid frame`;

      const result = parser.parse(stackTrace);

      // Should still parse with lower confidence
      expect(result).toBeDefined();
    });
  });

  describe('Async Stack Unwinding', () => {
    it('should unwind async call stacks', () => {
      const stackTrace = `Error: Async error
    at async handler (/src/handler.js:10:15)
    at async middleware (/src/middleware.js:20:8)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);

      const stacks = parser.unwindAsyncStack(result.trace!);
      expect(stacks.length).toBeGreaterThan(0);
    });
  });

  describe('Source Linking', () => {
    it('should link frames to source code', async () => {
      const stackTrace = `Error: Test
    at method (/src/file.js:10:15)`;

      const result = parser.parse(stackTrace);

      expect(result.success).toBe(true);

      const getSource = async (filePath: string, lineNumber: number) => {
        return `line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\nline 11`;
      };

      const linked = await parser.linkToSource(result.trace!, getSource);

      expect(linked.frames[0].sourceContext).toBeDefined();
      expect(linked.frames[0].sourceContext?.content).toContain('line 10');
    });
  });
});
