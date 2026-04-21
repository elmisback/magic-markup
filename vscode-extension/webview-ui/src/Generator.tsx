import { AnnotationEditorProps } from "./App";
import React, { useEffect, useState, useRef } from "react";
import e from "cors";
import "./tools.css";
import { ChatMessage, lmApi } from "./lm-api-client";


const Generator: React.FC<AnnotationEditorProps> = (props) => {
  // State management
  const [userInput, setUserInput] = useState(props.value.metadata.userInput || '');
  const [draftText, setDraftText] = useState(props.value.metadata.annotationDraftText || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(!!(props.value.metadata.annotationDraftText));
  const [isFinalized, setIsFinalized] = useState(props.value.metadata.isFinalized || false);
  const [useMock, setUseMock] = useState(false);
  const annotationTitle = props.value.metadata.annotationTitle || userInput || '';

  const dynamicActions = [
    {
      id: 'explain',
      label: 'Explain Highlighted Code',
      pattern: /\b(explain|what does this do|what does this code do|how does this work)\b/i,
      systemPrompt: `You write concise annotation text that explains highlighted code for learners.
Return markdown only. No title. Prefer short paragraphs and section headers like ### Purpose or ### Behavior. Use numbered lists for step-by-step logic. Preserve inline code with backticks.`,
      userSuffix: 'Explain the highlighted code clearly.',
    },
    {
      id: 'summarize',
      label: 'Summarize',
      pattern: /\b(summari[sz]e|summary|overview|brief|tldr|tl;dr)\b/i,
      systemPrompt: `You write a concise summary of highlighted code.
Return markdown only. No title. Keep it to 2-4 sentences max. Focus on what the code accomplishes at a high level, not implementation details.`,
      userSuffix: 'Summarize the highlighted code in a few sentences.',
    },
    {
      id: 'step-by-step',
      label: 'Step-by-Step Walkthrough',
      pattern: /\b(step[- ]by[- ]step|walkthrough|trace|line[- ]by[- ]line|walk through)\b/i,
      systemPrompt: `You write a step-by-step walkthrough of highlighted code.
Return markdown only. No title. Use a numbered list where each step explains what one logical chunk of the code does, in execution order. Keep each step to one sentence.`,
      userSuffix: 'Walk through the highlighted code step by step.',
    },
    {
      id: 'context',
      label: 'How Does This Fit In?',
      pattern: /\b(context|fit|role|purpose|why is this|relationship|how does this fit|within the)\b/i,
      systemPrompt: `You explain how a piece of highlighted code fits within its surrounding class, module, or file.
Return markdown only. No title. Focus on the role this code plays in the larger structure: what calls it, what it enables, why it exists here rather than elsewhere.`,
      userSuffix: 'Explain how the highlighted code fits within the overall class or module.',
    },
  ];

  const draftIsEmpty = !draftText.trim();
  const visibleActions = draftIsEmpty
    ? dynamicActions
    : dynamicActions.filter(a => a.pattern.test(userInput || annotationTitle));

  const isMounted = useRef(true);

  // Check API availability on mount
  useEffect(() => {
    const lmApiAvailable = typeof lmApi !== 'undefined' && lmApi !== null && typeof lmApi.chat === 'function';
    if (!lmApiAvailable) {
      setUseMock(true);
    }
    return () => { isMounted.current = false; };
  }, []);

  // Save state to metadata
  useEffect(() => {
    props.utils.setMetadata({
      userInput,
      annotationDraftText: draftText,
      annotationTitle: userInput || annotationTitle,
      isFinalized,
    });
  }, [userInput, draftText, isFinalized]);

  // Get document context
  const anchorText = props.utils.getText();
  const documentText = props.value.document || '';
  const startPos = props.value.start;
  const endPos = props.value.end;

  const createFormattedDocument = () => {
    if (!documentText) return '';
    const before = documentText.substring(0, startPos);
    const highlighted = documentText.substring(startPos, endPos);
    const after = documentText.substring(endPos);
    return `${before}<<<HIGHLIGHTED>${highlighted}</HIGHLIGHTED>>>${after}`;
  };

  const generateAnnotation = async () => {
    if (!userInput.trim()) {
      setError('Please describe what you want the annotation to do');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const formattedDocument = createFormattedDocument();

      const prompt: ChatMessage[] = [
        {
          role: "system",
          content: `You write concise annotation text that fulfills the user's requested annotation.

Return markdown only for the annotation body.
Do not include a title.
Do not default to generic "explain highlighted code" wording unless the user explicitly asked for an explanation.
Match the user's request closely.
Prefer short paragraphs and section headers only when they improve readability.
Preserve inline code formatting with backticks where useful.
Keep it clean enough to display directly inside an annotation.`
        },
        {
          role: "user",
          content:
            `User request: ${userInput}\n\n` +
            `Highlighted code with context:\n\n${formattedDocument || anchorText}\n\n` +
            `Write the annotation text now.`
        }
      ];

      let response: string;
      if (useMock) {
        await new Promise(r => setTimeout(r, 500));
        response = '### Purpose\nThis method compares Song objects to determine their ordering.\n\n### Behavior\n1. **Null Check**: Throws if the other song is null.\n2. **Title**: Compares titles lexicographically.\n3. **Artist**: If titles match, compares artists.\n4. **Duration**: If both match, compares duration numerically.\n5. **Genre**: Final tiebreaker on genre.';
      } else {
        response = await lmApi.chat(prompt, {
          vendor: 'copilot',
          family: 'gpt-4o',
          temperature: 0.35
        });
      }

      if (isMounted.current) {
        const nextDraft = response.trim();
        setDraftText(nextDraft);
        setHasGenerated(true);
        setIsFinalized(false);
        props.utils.setMetadata({
          annotationDraftText: nextDraft,
          annotationTitle: userInput,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while generating';
      console.error('[Generator] Error:', errorMsg, err);
      if (isMounted.current) {
        setError(errorMsg);
      }
    } finally {
      if (isMounted.current) {
        setIsGenerating(false);
      }
    }
  };

  const runDynamicAction = async (action: typeof dynamicActions[number]) => {
    if (!anchorText.trim()) {
      setError('No highlighted code selected');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const formattedDocument = createFormattedDocument();
      const prompt: ChatMessage[] = [
        { role: "system", content: action.systemPrompt },
        {
          role: "user",
          content:
            `${action.userSuffix}\n\n` +
            `Highlighted code with context:\n\n${formattedDocument || anchorText}`
        }
      ];

      let response: string;
      if (useMock) {
        await new Promise(r => setTimeout(r, 500));
        response = `Mock result for "${action.label}".\n\nThis is placeholder text from the mock API.`;
      } else {
        response = await lmApi.chat(prompt, {
          vendor: 'copilot',
          family: 'gpt-4o',
          temperature: 0.35
        });
      }

      if (isMounted.current) {
        const nextDraft = response.trim();
        setDraftText(nextDraft);
        setHasGenerated(true);
        props.utils.setMetadata({ annotationDraftText: nextDraft });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : `Failed: ${action.label}`;
      console.error(`[Generator] ${action.id} error:`, errorMsg, err);
      if (isMounted.current) {
        setError(errorMsg);
      }
    } finally {
      if (isMounted.current) {
        setIsGenerating(false);
      }
    }
  };

  const resetGenerator = () => {
    setDraftText('');
    setError(null);
    setHasGenerated(false);
    setIsFinalized(false);
    props.utils.setMetadata({
      annotationDraftText: '',
      annotationTitle: '',
      isFinalized: false,
    });
  };

  const finalizeAnnotation = () => {
    props.utils.setMetadata({
      annotationDraftText: draftText,
      annotationTitle: userInput || annotationTitle,
      isFinalized: true,
    });
    setIsFinalized(true);
  };

  const editAnnotation = () => {
    setIsFinalized(false);
  };

  // Finalized state
  if (hasGenerated && isFinalized) {
    return (
      <div style={{
        padding: "10px",
        fontFamily: "Poppins, sans-serif",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}>
        <div style={{
          marginBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          color: "#666",
        }}>
          <span style={{ fontStyle: "italic" }}>{userInput || annotationTitle || 'Annotation'}</span>
          <button
            onClick={editAnnotation}
            style={{
              padding: "3px 8px",
              backgroundColor: "transparent",
              color: "#0078D4",
              border: "1px solid #0078D4",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            Edit
          </button>
        </div>
        <div style={{
          width: "100%",
          boxSizing: "border-box",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}>
          <div style={{ ...commonTextStyle, lineHeight: "1.6" }}>
            <SimpleMarkdown>{draftText || "(No generated text yet)"}</SimpleMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Active state: editing draft
  if (hasGenerated && !isFinalized) {
    return (
      <div style={{
        padding: "10px",
        fontFamily: "Poppins, sans-serif",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}>
        <div style={{
          marginBottom: "10px",
          padding: "8px",
          backgroundColor: "#E8F5E9",
          border: "1px solid #4CAF50",
          borderRadius: "4px",
          fontSize: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>✓ Generated annotation active</span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={finalizeAnnotation}
              style={{
                padding: "4px 8px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              Finalize
            </button>
            <button
              onClick={resetGenerator}
              style={{
                padding: "4px 8px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              Reset
            </button>
          </div>
        </div>
        <div style={{ marginTop: "10px" }}>
          {visibleActions.length > 0 && (
            <div style={{ marginBottom: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {visibleActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => runDynamicAction(action)}
                  disabled={isGenerating}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: isGenerating ? "#cccccc" : "#ffffff",
                    color: "#111111",
                    border: "1px solid #888",
                    borderRadius: "4px",
                    cursor: isGenerating ? "default" : "pointer",
                    fontSize: "13px",
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value);
              props.utils.setMetadata({
                annotationDraftText: e.target.value,
                explanation: e.target.value,
                content: e.target.value,
                text: e.target.value,
                summary: e.target.value,
              });
            }}
            style={{
              width: "100%",
              minHeight: "260px",
              fontFamily: "Poppins, sans-serif",
              fontSize: "13px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              resize: "vertical",
              boxSizing: "border-box",
              marginBottom: "8px",
              lineHeight: "1.5",
            }}
          />
        </div>

        {error && (
          <div style={{
            color: "#D83B01",
            backgroundColor: "#FED9CC",
            padding: "8px",
            borderRadius: "4px",
            marginTop: "8px",
            fontSize: "13px",
          }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Otherwise, show the input interface
  return (
    <div style={{ padding: "10px", fontFamily: "Poppins, sans-serif" }}>
      <div style={{ marginBottom: "12px" }}>
        <label style={{
          display: "block",
          marginBottom: "6px",
          fontWeight: "bold",
          fontSize: "14px"
        }}>
          Describe the annotation you want to create:
        </label>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Example: Create a color picker that lets me change the hex color value in this code... or Create a timer that counts down from the number in this variable..."
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontSize: "14px",
            minHeight: "80px",
            resize: "vertical",
            fontFamily: "Poppins, sans-serif"
          }}
        />
      </div>

      <div style={{ marginBottom: "15px", display: "flex", gap: "10px", alignItems: "center" }}>
        <button
          onClick={generateAnnotation}
          disabled={isGenerating || !userInput.trim()}
          style={{
            padding: "6px 12px",
            backgroundColor: isGenerating ? "#cccccc" : "#0078D4",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isGenerating ? "default" : "pointer",
            fontSize: "14px"
          }}
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>

      </div>

      {error && (
        <div style={{
          color: "#D83B01",
          backgroundColor: "#FED9CC",
          padding: "8px",
          borderRadius: "4px",
          marginBottom: "12px",
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: "15px",
        padding: "10px",
        backgroundColor: "#F0F0F0",
        borderRadius: "4px",
        fontSize: "12px",
        color: "#666"
      }}>
        <strong>Tips:</strong>
        <ul style={{ marginTop: "5px", marginBottom: "0", paddingLeft: "20px" }}>
          <li>Be specific about what the annotation should do</li>
          <li>Describe the exact behavior and UI you want</li>
          <li>Mention if it should interact with the highlighted text</li>
          <li>State if data should persist across sessions</li>
          <li>Examples: "rating stars", "color picker", "countdown timer", "progress tracker"</li>
        </ul>
      </div>
    </div>
  );
};

export {Generator};