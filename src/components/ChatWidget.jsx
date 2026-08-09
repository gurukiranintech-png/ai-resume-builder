import { useEffect, useRef, useState } from "react";
import { chatWithAI } from "../services/aiService";
import "./ChatWidget.css";

function ChatWidget() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: "assistant", text: "Hi! I'm your AI career assistant. Ask me anything about your resume, job search, or interview prep." },
    ]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const bodyRef = useRef(null);

    useEffect(() => {
        if (bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
    }, [messages, open, sending]);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || sending) return;

        const nextMessages = [...messages, { role: "user", text: trimmed }];
        setMessages(nextMessages);
        setInput("");
        setSending(true);

        try {
            const history = nextMessages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .slice(-10);

            const data = await chatWithAI(trimmed, history);

            if (data.success) {
                setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
            } else {
                throw new Error("Failed");
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", text: "Sorry, I ran into an issue. Please try again." },
            ]);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {open && (
                <div className="chat-panel">
                    <div className="chat-panel-header">
                        <div className="chat-panel-title">
                            <span className="chat-panel-icon">✦</span>
                            <div>
                                <strong>AI Career Assistant</strong>
                                <p>Resume &amp; job search help</p>
                            </div>
                        </div>
                        <button className="chat-close-button" onClick={() => setOpen(false)}>
                            ✕
                        </button>
                    </div>

                    <div className="chat-panel-body" ref={bodyRef}>
                        {messages.map((m, i) => (
                            <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
                                {m.text}
                            </div>
                        ))}
                        {sending && (
                            <div className="chat-bubble chat-bubble-assistant chat-typing">
                                <span></span><span></span><span></span>
                            </div>
                        )}
                    </div>

                    <div className="chat-panel-input">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your resume, interviews, job search..."
                            rows={1}
                            disabled={sending}
                        />
                        <button
                            className="chat-send-button"
                            onClick={handleSend}
                            disabled={sending || !input.trim()}
                        >
                            →
                        </button>
                    </div>
                </div>
            )}

            <button
                className="chat-bubble-toggle"
                onClick={() => setOpen((prev) => !prev)}
                aria-label="Open AI chat assistant"
            >
                {open ? "✕" : "✦"}
            </button>
        </>
    );
}

export default ChatWidget;
