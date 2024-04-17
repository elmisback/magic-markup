export function createPrompt(input_expression_code) { return `

Consider the following Python code.

python
import math

def compute_expression(N):
    return math.log(1 + 1/N)

We can represent this expression in MathJS a format for floating-point analysis, as follows:
log(1 + (1 / N))

Now, represent the following expression pulled from a larger file (which may or may not be Python!) as an MathJS expression:
${input_expression_code}

Respond with just the MathJS expression. Again, your response should be only the MathJS expression. Note that the expression may include property lookups, assignments, etc, but these should be abstracted away in the MathJS.

`;}

/* OLD FPCORE PROMPT:

Consider the following Python code.

python
import math

def compute_expression(N):
    if N > 1 and N < 1e+40:
        if N >= 1e+3:
            return 1/N - 1/(2*N**2) + 1/(3*N**3) - 1/(4*N**4)
        else:
            return math.log(1 + 1/N)
    else:
        return "N is out of the valid range"

We can represent this expression in FPCore, a format for floating-point analysis, as follows:
(FPCore (N)
 :pre (and (> N 1) (< N 1e+40))
 (if (>= N 1e+3)
    (+ (/ 1 N) (/ -1 (* 2 (pow N 2))) (/ 1 (* 3 (pow N 3))) (/ -1 (* 4 (pow N 4))))
    (log (+ 1 (/ 1 N)))))

Now, represent the following expression pulled from a larger file (which may or may not be Python!) as an FPCore expression:
${input_expression_code}

Respond with just the FPCore expression. Again, your response should be only the FPCore expression. Note that the expression may include property lookups, assignments, etc, but these should be abstracted away in the FPCore.

*/