import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";
import "./Login.css";
import "./Register.css";

function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ name: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await registerUser(formData);
            navigate("/login");
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="background-circle circle-one"></div>
            <div className="background-circle circle-two"></div>

            <div className="register-container">
                <div className="login-card register-card">
                    <div className="login-card-header">
                        <div className="mobile-logo">
                            <div className="brand-logo">
                                <span>R</span>
                                <div className="ai-badge">AI</div>
                            </div>
                        </div>

                        <span className="login-label">GET STARTED</span>
                        <h2>Create Account</h2>
                        <p>Create your account to build and manage your resume.</p>
                    </div>

                    {error && <div className="error-message"><span>⚠</span>{error}</div>}

                    <form onSubmit={handleRegister} className="login-form">
                        <div className="input-group">
                            <label htmlFor="name">Full Name</label>
                            <div className="input-wrapper">
                                <span className="input-icon">👤</span>
                                <input
                                    id="name"
                                    type="text"
                                    name="name"
                                    placeholder="Enter your name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="email">Email Address</label>
                            <div className="input-wrapper">
                                <span className="input-icon">✉</span>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper">
                                <span className="input-icon">🔒</span>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    placeholder="Create a password (min. 6 characters)"
                                    value={formData.password}
                                    onChange={handleChange}
                                    minLength={6}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? (
                                <><span className="spinner"></span>Creating Account...</>
                            ) : (
                                <>Create Account<span>→</span></>
                            )}
                        </button>
                    </form>

                    <div className="register-section">
                        <p>Already have an account? <Link to="/login">Sign In</Link></p>
                    </div>

                    <div className="login-footer">
                        <span>Secure Signup</span>
                        <span>•</span>
                        <span>AI Resume Builder</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Register;