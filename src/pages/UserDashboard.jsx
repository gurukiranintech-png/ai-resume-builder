import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { updateMyProfile, uploadProfilePicture } from "../services/userService";
import "./UserDashboard.css";
import ChatWidget from "../components/ChatWidget";
import jsPDF from "jspdf";

const API_ORIGIN = api.defaults.baseURL.replace(/\/api\/?$/, "");

function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

const emptyPersonalInfo = { name: "", email: "", phone: "", location: "", github: "", linkedin: "" };
const emptyEducation = { degree: "", institution: "", year: "" };
const emptyExperience = { role: "", company: "", duration: "", description: "" };
const emptyProject = { title: "", description: "" };

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #dbe3ef",
    fontFamily: "inherit",
    fontSize: "13px",
    marginBottom: "10px",
};

const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" };

function UserDashboard() {
    const navigate = useNavigate();
    const pictureInputRef = useRef(null);

    const [user, setUser] = useState(null);
    const [resume, setResume] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [showEditProfile, setShowEditProfile] = useState(false);
    const [bio, setBio] = useState("");
    const [phone, setPhone] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const [profileError, setProfileError] = useState("");

    // ==========================================
    // MANUAL ENTRY FORM STATE
    // ==========================================
    const [personalInfo, setPersonalInfo] = useState(emptyPersonalInfo);
    const [skillsText, setSkillsText] = useState("");
    const [certificationsText, setCertificationsText] = useState("");
    const [awardsText, setAwardsText] = useState("");
    const [education, setEducation] = useState([{ ...emptyEducation }]);
    const [experience, setExperience] = useState([{ ...emptyExperience }]);
    const [projects, setProjects] = useState([{ ...emptyProject }]);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (!token || !storedUser) {
            navigate("/login");
            return;
        }

        setUser(JSON.parse(storedUser));
        fetchResume();
    }, []);

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(""), 3000);
        return () => clearTimeout(timer);
    }, [toast]);

    const fetchResume = async () => {
        try {
            const response = await api.get("/resumes/me");
            if (response.data.success) {
                setResume(response.data.resume);
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.error("Failed to fetch resume:", error);
                setError("Failed to load resume");
            }
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // FORM HELPERS
    // ==========================================

    const updateArrayRow = (setter, index, field, value) => {
        setter((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    const addRow = (setter, template) => {
        setter((rows) => [...rows, { ...template }]);
    };

    const removeRow = (setter, index) => {
        setter((rows) => rows.filter((_, i) => i !== index));
    };

    const prefillFormFromResume = (r) => {
        setPersonalInfo({ ...emptyPersonalInfo, ...(r.personalInfo || {}) });
        setSkillsText((r.skills || []).join(", "));
        setCertificationsText((r.certifications || []).join(", "));
        setAwardsText((r.awards || []).join(", "));
        setEducation(r.education?.length ? r.education : [{ ...emptyEducation }]);
        setExperience(r.experience?.length ? r.experience : [{ ...emptyExperience }]);
        setProjects(r.projects?.length ? r.projects : [{ ...emptyProject }]);
    };

    const resetForm = () => {
        setPersonalInfo({ ...emptyPersonalInfo });
        setSkillsText("");
        setCertificationsText("");
        setAwardsText("");
        setEducation([{ ...emptyEducation }]);
        setExperience([{ ...emptyExperience }]);
        setProjects([{ ...emptyProject }]);
    };

    const handleSubmitInfo = async () => {
        if (!personalInfo.name.trim()) {
            setError("Please enter your name.");
            return;
        }

        setSubmitting(true);
        setError("");

        const payload = {
            personalInfo,
            skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
            certifications: certificationsText.split(",").map((s) => s.trim()).filter(Boolean),
            awards: awardsText.split(",").map((s) => s.trim()).filter(Boolean),
            education: education.filter((e) => e.degree || e.institution),
            experience: experience.filter((e) => e.role || e.company),
            projects: projects.filter((p) => p.title || p.description),
        };

        try {
            const response = await api.post("/resumes/submit", payload);
            if (response.data.success) {
                await fetchResume();
                setShowForm(false);
                setToast("Information submitted and analyzed");
            }
        } catch (error) {
            console.error("Submit error:", error);
            setError(error.response?.data?.message || "Failed to submit information");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = () => {
        if (resume) prefillFormFromResume(resume);
        setShowForm(true);
    };

    const handleAddNewClick = () => {
        resetForm();
        setShowForm(true);
    };

    const handleDeleteConfirmed = async () => {
        setShowConfirm(false);

        try {
            const response = await api.delete("/resumes/me");
            if (response.data.success) {
                setResume(null);
                setToast("Information deleted");
            }
        } catch (error) {
            console.error("Delete error:", error);
            setError(error.response?.data?.message || "Failed to delete");
        }
    };

    // ==========================================
    // DOWNLOAD MY INPUT AS WORD (.doc)
    // ==========================================

    const downloadAsWord = () => {
        if (!resume) return;

        const esc = (v) => (v || "").toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const eduHtml = (resume.education || [])
            .map((e) => `<li>${esc(e.degree)} — ${esc(e.institution)} ${e.year ? `(${esc(e.year)})` : ""}</li>`)
            .join("");

        const expHtml = (resume.experience || [])
            .map((e) => `<li><b>${esc(e.role)}</b> at ${esc(e.company)} ${e.duration ? `(${esc(e.duration)})` : ""}<br/>${esc(e.description)}</li>`)
            .join("");

        const projHtml = (resume.projects || [])
            .map((p) => `<li><b>${esc(p.title)}</b><br/>${esc(p.description)}</li>`)
            .join("");

        const html = `
            <h2>${esc(resume.personalInfo?.name)}</h2>
            <p>${esc(resume.personalInfo?.email)} | ${esc(resume.personalInfo?.phone)} | ${esc(resume.personalInfo?.location)}</p>
            <p>${esc(resume.personalInfo?.github)} ${esc(resume.personalInfo?.linkedin)}</p>

            <h3>Skills</h3>
            <p>${esc((resume.skills || []).join(", "))}</p>

            <h3>Education</h3>
            <ul>${eduHtml}</ul>

            <h3>Experience</h3>
            <ul>${expHtml}</ul>

            <h3>Projects</h3>
            <ul>${projHtml}</ul>

            <h3>Certifications</h3>
            <p>${esc((resume.certifications || []).join(", "))}</p>

            <h3>Awards</h3>
            <p>${esc((resume.awards || []).join(", "))}</p>
        `;

        const fullHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${html}</body></html>`;

        const blob = new Blob([fullHtml], { type: "application/msword" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${resume.personalInfo?.name || "my-info"}.doc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const persistUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
    };

    const openEditProfile = () => {
        setBio(user?.bio || "");
        setPhone(user?.phone || "");
        setProfileError("");
        setShowEditProfile(true);
    };

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        setProfileError("");

        try {
            const data = await updateMyProfile({ bio, phone });
            if (data.success) {
                persistUser(data.user);
                setToast("Profile updated");
                setShowEditProfile(false);
            }
        } catch (error) {
            console.error("Update profile error:", error);
            setProfileError(error.response?.data?.message || "Failed to update profile");
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePictureInput = async (event) => {
        const file = event.target.files[0];
        event.target.value = "";
        if (!file) return;

        setUploadingPicture(true);
        setProfileError("");

        try {
            const data = await uploadProfilePicture(file);
            if (data.success) {
                persistUser(data.user);
                setToast("Profile picture updated");
            }
        } catch (error) {
            console.error("Upload picture error:", error);
            setProfileError(error.response?.data?.message || "Failed to upload picture");
        } finally {
            setUploadingPicture(false);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-loading">Loading...</div>
            </div>
        );
    }

    const pictureUrl = user?.profilePicture ? `${API_ORIGIN}${user.profilePicture}` : null;

    return (
        <div className="dashboard-page">
            <div className="background-circle circle-one"></div>
            <div className="background-circle circle-two"></div>

            <div className="dashboard-container">

                {/* Top bar */}
                <div className="dashboard-topbar">
                    <div className="dashboard-brand">
                        <div className="brand-logo">
                            <span>R</span>
                            <div className="ai-badge">AI</div>
                        </div>
                        <div>
                            <h1>AI Resume Builder</h1>
                            <p>User Dashboard</p>
                        </div>
                    </div>

                    <button className="logout-button" onClick={handleLogout}>
                        Logout
                    </button>
                </div>

                {/* Profile card */}
                {user && (
                    <div className="profile-card">
                        <div
                            className="profile-avatar"
                            style={pictureUrl ? { padding: 0, overflow: "hidden" } : undefined}
                        >
                            {pictureUrl ? (
                                <img
                                    src={pictureUrl}
                                    alt={user.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                                />
                            ) : (
                                user.name?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h2>{user.name}</h2>
                            <p>{user.email}</p>
                            {user.bio && <p style={{ margin: "2px 0 6px" }}>{user.bio}</p>}
                            {user.phone && <p style={{ margin: "0 0 6px" }}>{user.phone}</p>}
                            <span className="role-badge">{user.role}</span>
                        </div>
                        <button className="upload-link" onClick={openEditProfile}>
                            Edit Profile
                        </button>
                    </div>
                )}

                {error && <div className="error-message"><span>⚠</span>{error}</div>}

                {/* Resume / manual info section */}
                <div className="resume-card">
                    <div className="resume-card-header">
                        <h2>My Information</h2>
                        {resume && !showForm && (
                            <button className="upload-link" onClick={handleEditClick}>
                                Edit
                            </button>
                        )}
                    </div>

                    {submitting && (
                        <div className="uploading-banner">
                            <span className="spinner"></span>
                            Analyzing your information with Gemini...
                        </div>
                    )}

                    {!showForm && !resume && !submitting && (
                        <div className="uploaded-state">
                            <p>You haven't entered your information yet.</p>
                            <button className="modal-confirm" onClick={handleAddNewClick}>
                                Enter My Information
                            </button>
                        </div>
                    )}

                    {!showForm && resume && !submitting && (
                        <div className="uploaded-state">
                            <div className="uploaded-icon">✅</div>
                            <p>Your information has been submitted successfully.</p>
                            <p className="uploaded-hint">An administrator will review your AI summary shortly.</p>

                            {resume.createdAt && (
                                <div className="file-meta">
                                    <span className="file-date">submitted {formatDate(resume.createdAt)}</span>
                                </div>
                            )}

                            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "12px" }}>
                                <button className="upload-link" onClick={downloadAsWord}>
                                    Download as Word
                                </button>
                                <button className="delete-button" onClick={() => setShowConfirm(true)}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}

                    {showForm && (
                        <div style={{ textAlign: "left" }}>
                            <h3>Personal Info</h3>
                            <label style={labelStyle}>Full Name *</label>
                            <input style={inputStyle} value={personalInfo.name}
                                onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })} />

                            <label style={labelStyle}>Email</label>
                            <input style={inputStyle} value={personalInfo.email}
                                onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })} />

                            <label style={labelStyle}>Phone</label>
                            <input style={inputStyle} value={personalInfo.phone}
                                onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })} />

                            <label style={labelStyle}>Location</label>
                            <input style={inputStyle} value={personalInfo.location}
                                onChange={(e) => setPersonalInfo({ ...personalInfo, location: e.target.value })} />

                            <label style={labelStyle}>GitHub</label>
                            <input style={inputStyle} value={personalInfo.github}
                                onChange={(e) => setPersonalInfo({ ...personalInfo, github: e.target.value })} />

                            <label style={labelStyle}>LinkedIn</label>
                            <input style={inputStyle} value={personalInfo.linkedin}
                                onChange={(e) => setPersonalInfo({ ...personalInfo, linkedin: e.target.value })} />

                            <h3>Skills (comma separated)</h3>
                            <input style={inputStyle} value={skillsText} onChange={(e) => setSkillsText(e.target.value)}
                                placeholder="React, Node.js, MongoDB" />

                            <h3>Education</h3>
                            {education.map((row, i) => (
                                <div key={i} style={{ border: "1px solid #eee", padding: "10px", borderRadius: "8px", marginBottom: "10px" }}>
                                    <input style={inputStyle} placeholder="Degree" value={row.degree}
                                        onChange={(e) => updateArrayRow(setEducation, i, "degree", e.target.value)} />
                                    <input style={inputStyle} placeholder="Institution" value={row.institution}
                                        onChange={(e) => updateArrayRow(setEducation, i, "institution", e.target.value)} />
                                    <input style={inputStyle} placeholder="Year" value={row.year}
                                        onChange={(e) => updateArrayRow(setEducation, i, "year", e.target.value)} />
                                    {education.length > 1 && (
                                        <button className="delete-button" onClick={() => removeRow(setEducation, i)}>Remove</button>
                                    )}
                                </div>
                            ))}
                            <button className="upload-link" onClick={() => addRow(setEducation, emptyEducation)}>+ Add Education</button>

                            <h3 style={{ marginTop: "16px" }}>Experience</h3>
                            {experience.map((row, i) => (
                                <div key={i} style={{ border: "1px solid #eee", padding: "10px", borderRadius: "8px", marginBottom: "10px" }}>
                                    <input style={inputStyle} placeholder="Role / Title" value={row.role}
                                        onChange={(e) => updateArrayRow(setExperience, i, "role", e.target.value)} />
                                    <input style={inputStyle} placeholder="Company" value={row.company}
                                        onChange={(e) => updateArrayRow(setExperience, i, "company", e.target.value)} />
                                    <input style={inputStyle} placeholder="Duration (e.g. Jan 2023 - Present)" value={row.duration}
                                        onChange={(e) => updateArrayRow(setExperience, i, "duration", e.target.value)} />
                                    <textarea style={inputStyle} rows={3} placeholder="Description" value={row.description}
                                        onChange={(e) => updateArrayRow(setExperience, i, "description", e.target.value)} />
                                    {experience.length > 1 && (
                                        <button className="delete-button" onClick={() => removeRow(setExperience, i)}>Remove</button>
                                    )}
                                </div>
                            ))}
                            <button className="upload-link" onClick={() => addRow(setExperience, emptyExperience)}>+ Add Experience</button>

                            <h3 style={{ marginTop: "16px" }}>Projects</h3>
                            {projects.map((row, i) => (
                                <div key={i} style={{ border: "1px solid #eee", padding: "10px", borderRadius: "8px", marginBottom: "10px" }}>
                                    <input style={inputStyle} placeholder="Project Title" value={row.title}
                                        onChange={(e) => updateArrayRow(setProjects, i, "title", e.target.value)} />
                                    <textarea style={inputStyle} rows={3} placeholder="Description" value={row.description}
                                        onChange={(e) => updateArrayRow(setProjects, i, "description", e.target.value)} />
                                    {projects.length > 1 && (
                                        <button className="delete-button" onClick={() => removeRow(setProjects, i)}>Remove</button>
                                    )}
                                </div>
                            ))}
                            <button className="upload-link" onClick={() => addRow(setProjects, emptyProject)}>+ Add Project</button>

                            <h3 style={{ marginTop: "16px" }}>Certifications (comma separated)</h3>
                            <input style={inputStyle} value={certificationsText} onChange={(e) => setCertificationsText(e.target.value)} />

                            <h3>Awards (comma separated)</h3>
                            <input style={inputStyle} value={awardsText} onChange={(e) => setAwardsText(e.target.value)} />

                            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                                <button className="modal-cancel" onClick={() => setShowForm(false)} disabled={submitting}>
                                    Cancel
                                </button>
                                <button className="modal-confirm" onClick={handleSubmitInfo} disabled={submitting}>
                                    {submitting ? "Submitting..." : "Submit"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete confirmation modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete My Information?</h3>
                        <p>This action can't be undone. You'll need to enter it again.</p>
                        <div className="modal-actions">
                            <button className="modal-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
                            <button className="modal-confirm" onClick={handleDeleteConfirmed}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit profile modal */}
            {showEditProfile && (
                <div className="modal-overlay" onClick={() => !savingProfile && setShowEditProfile(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Edit Profile</h3>

                        <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "6px 0 18px" }}>
                            <div
                                className="profile-avatar"
                                style={{ width: "56px", height: "56px", padding: pictureUrl ? 0 : undefined, overflow: "hidden" }}
                            >
                                {pictureUrl ? (
                                    <img
                                        src={pictureUrl}
                                        alt={user?.name}
                                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                                    />
                                ) : (
                                    user?.name?.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div>
                                <input
                                    ref={pictureInputRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    onChange={handlePictureInput}
                                    disabled={uploadingPicture}
                                    hidden
                                />
                                <button
                                    className="upload-link"
                                    type="button"
                                    onClick={() => pictureInputRef.current?.click()}
                                    disabled={uploadingPicture}
                                >
                                    {uploadingPicture ? "Uploading..." : "Change Photo"}
                                </button>
                            </div>
                        </div>

                        <div style={{ textAlign: "left", marginBottom: "14px" }}>
                            <label style={labelStyle}>Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={300}
                                rows={3}
                                placeholder="Tell us a little about yourself..."
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ textAlign: "left", marginBottom: "6px" }}>
                            <label style={labelStyle}>Phone number</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="e.g. +91 98765 43210"
                                style={inputStyle}
                            />
                        </div>

                        {profileError && (
                            <div className="error-message" style={{ marginTop: "12px" }}>
                                <span>⚠</span>{profileError}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="modal-cancel" onClick={() => setShowEditProfile(false)} disabled={savingProfile}>
                                Cancel
                            </button>
                            <button className="modal-confirm" onClick={handleSaveProfile} disabled={savingProfile}>
                                {savingProfile ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && <div className="toast">{toast}</div>}

            <ChatWidget />
        </div>
    );
}

export default UserDashboard;