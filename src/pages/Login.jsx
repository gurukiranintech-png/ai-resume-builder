import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../services/authService";
import "./Login.css";

const adminLogoStyle = {
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
};

function AdminShieldIcon() {
    return (
        <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M32 4 L56 12 V29 C56 45 46 55 32 60 C18 55 8 45 8 29 V12 Z"
                fill="#4338ca"
            />
            <path
                d="M32 8 L52 15 V29 C52 42.5 44 51 32 55.5 C20 51 12 42.5 12 29 V15 Z"
                fill="#ffffff"
                fillOpacity="0.14"
            />
            <circle cx="32" cy="26" r="8" fill="#ffffff" />
            <path
                d="M16 46 C16 36 23 31 32 31 C41 31 48 36 48 46 C41 52 24 52 16 46 Z"
                fill="#ffffff"
            />
        </svg>
    );
}

function Login() {
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const data = await loginUser(email, password);

            if (role === "admin" && data.user.role !== "admin") {
                throw new Error("This account is not an admin account.");
            }
            if (role === "user" && data.user.role !== "user") {
                throw new Error("This account is not a user account.");
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            navigate(data.user.role === "admin" ? "/admin" : "/dashboard");
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!role) {
        return (
            <div className="login-page">
                <div className="background-circle circle-one"></div>
                <div className="background-circle circle-two"></div>

                <div className="role-container">
                    <div className="brand-section">
                        <div className="brand-logo">
                            <span>R</span>
                            <div className="ai-badge">AI</div>
                        </div>

                        <h1>AI Resume<span> Builder</span></h1>
                        <p>Build a resume that gets noticed.</p>

                        <div className="feature-list">
                            <div className="feature">
                                <span>✦</span>
                                <div><strong>AI-Powered</strong><p>Smart resume generation</p></div>
                            </div>
                            <div className="feature">
                                <span>✓</span>
                                <div><strong>ATS Optimized</strong><p>Improve your hiring chances</p></div>
                            </div>
                            <div className="feature">
                                <span>✧</span>
                                <div><strong>Role Specific</strong><p>Tailored to your dream job</p></div>
                            </div>
                        </div>
                    </div>

                    <div className="role-card">
                        <div className="role-card-header">
                            <span className="sparkle">✦</span>
                            <h2>Welcome to AI Resume Builder</h2>
                            <p>Choose how you want to continue</p>
                        </div>

                        <div className="role-options">
                            <button className="role-option user-option" onClick={() => setRole("user")}>
                                <div className="role-icon">👤</div>
                                <div className="role-content">
                                    <h3>User</h3>
                                    <p>Create and manage your resume</p>
                                </div>
                                <span className="arrow">→</span>
                            </button>

                            <button className="role-option admin-option" onClick={() => setRole("admin")}>
                                <div className="role-icon" style={adminLogoStyle}>
                                    <AdminShieldIcon />
                                </div>
                                <div className="role-content">
                                    <h3>Admin</h3>
                                    <p>Access administration dashboard</p>
                                </div>
                                <span className="arrow">→</span>
                            </button>
                        </div>

                        <div className="role-footer">
                            <span>AI Resume Builder</span>
                            <span>•</span>
                            <span>Smart. Simple. Powerful.</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="background-circle circle-one"></div>
            <div className="background-circle circle-two"></div>
            <div className="background-circle circle-three"></div>

            <div className="login-container">
                <div className="login-brand">
                    <button
                        className="back-button"
                        onClick={() => { setRole(null); setError(""); setEmail(""); setPassword(""); }}
                    >
                        ← Back
                    </button>

                    <div className="brand-logo large-logo">
                        <span>R</span>
                        <div className="ai-badge">AI</div>
                    </div>

                    <h1>Build your<br /><span>future.</span></h1>
                    <p className="brand-description">
                        Create professional, ATS-friendly resumes powered by artificial intelligence.
                    </p>

                    <div className="feature-list">
                        <div className="feature">
                            <span>✦</span>
                            <div><strong>AI Resume Analysis</strong><p>Get intelligent feedback on your resume</p></div>
                        </div>
                        <div className="feature">
                            <span>✓</span>
                            <div><strong>ATS Optimization</strong><p>Improve your resume score</p></div>
                        </div>
                        <div className="feature">
                            <span>✧</span>
                            <div><strong>Career Ready</strong><p>Stand out from other candidates</p></div>
                        </div>
                    </div>
                </div>

                <div className="login-card">
                    <div className="login-card-header">
                        <div className="mobile-logo">
                            <div className="brand-logo">
                                <span>R</span>
                                <div className="ai-badge">AI</div>
                            </div>
                        </div>

                        <span className="login-label">
                            {role === "admin" ? "ADMIN PORTAL" : "USER PORTAL"}
                        </span>
                        <h2>{role === "admin" ? "Admin Login" : "Welcome Back"}</h2>
                        <p>
                            {role === "admin"
                                ? "Sign in to access the administration dashboard."
                                : "Sign in to continue building your career."}
                        </p>
                    </div>

                    {error && <div className="error-message"><span>⚠</span>{error}</div>}

                    <form onSubmit={handleLogin} className="login-form">
                        <div className="input-group">
                            <label htmlFor="email">Email Address</label>
                            <div className="input-wrapper">
                                <span className="input-icon">✉</span>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    placeholder="you@example.com"
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="password-label">
                                <label htmlFor="password">Password</label>
                                {role === "user" && (
                                    <button
                                        type="button"
                                        className="forgot-button"
                                        onClick={() => alert("Password reset will be added soon.")}
                                    >
                                        Forgot password?
                                    </button>
                                )}
                            </div>
                            <div className="input-wrapper">
                                <span className="input-icon">🔒</span>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    placeholder="Enter your password"
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? "◉" : "○"}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? (
                                <><span className="spinner"></span>Signing in...</>
                            ) : (
                                <>{role === "admin" ? "Sign In as Admin" : "Sign In"}<span>→</span></>
                            )}
                        </button>
                    </form>

                    {role === "user" && (
                        <div className="register-section">
                            <p>Don't have an account? <Link to="/register">Create Account</Link></p>
                        </div>
                    )}

                    {role === "admin" && (
                        <div className="admin-note">
                            <span>🛡️</span>
                            <p>This area is restricted to authorized administrators.</p>
                        </div>
                    )}

                    <div className="login-footer">
                        <span>Secure Login</span>
                        <span>•</span>
                        <span>AI Resume Builder</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
