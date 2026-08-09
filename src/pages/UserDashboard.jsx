import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { updateMyProfile, uploadProfilePicture } from "../services/userService";
import "./UserDashboard.css";
import ChatWidget from "../components/ChatWidget";

const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const API_ORIGIN = api.defaults.baseURL.replace(/\/api\/?$/, "");

function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function UserDashboard() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const pictureInputRef = useRef(null);

    const [user, setUser] = useState(null);
    const [resume, setResume] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [showEditProfile, setShowEditProfile] = useState(false);
    const [bio, setBio] = useState("");
    const [phone, setPhone] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const [profileError, setProfileError] = useState("");

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

    const uploadFile = async (file) => {
        if (!file) return;

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError("Please upload a PDF or DOCX file.");
            return;
        }

        const formData = new FormData();
        formData.append("resume", file);

        setUploading(true);
        setError("");

        try {
            const response = await api.post("/resumes/upload", formData);
            if (response.data.success) {
                setResume(response.data.resume);
                setToast("Resume uploaded successfully");
            }
        } catch (error) {
            console.error("Upload error:", error);
            setError(error.response?.data?.message || "Failed to upload resume");
        } finally {
            setUploading(false);
        }
    };

    const handleFileInput = (event) => {
        uploadFile(event.target.files[0]);
        event.target.value = "";
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragging(false);
        uploadFile(event.dataTransfer.files[0]);
    };

    const handleDeleteConfirmed = async () => {
        setShowConfirm(false);

        try {
            const response = await api.delete("/resumes/me");
            if (response.data.success) {
                setResume(null);
                setToast("Resume deleted");
            }
        } catch (error) {
            console.error("Delete error:", error);
            setError(error.response?.data?.message || "Failed to delete resume");
        }
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

                {/* Resume upload section */}
                <div className="resume-card">
                    <div className="resume-card-header">
                        <h2>My Resume</h2>
                        {resume && (
                            <button
                                className="upload-link"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Upload New
                            </button>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileInput}
                        disabled={uploading}
                        hidden
                    />

                    {uploading && (
                        <div className="uploading-banner">
                            <span className="spinner"></span>
                            Analyzing resume with Gemini...
                        </div>
                    )}

                    {!resume && !uploading ? (
                        <div
                            className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <div className="empty-icon">📄</div>
                            <p className="dropzone-title">
                                Drag & drop your resume here
                            </p>
                            <p className="upload-hint">or click to browse · PDF or DOCX, up to 5MB</p>
                        </div>
                    ) : resume && !uploading ? (
                        <div className="uploaded-state">
                            <div className="uploaded-icon">✅</div>
                            <p>Your resume has been uploaded successfully.</p>
                            <p className="uploaded-hint">
                                An administrator will review it shortly.
                            </p>

                            {resume.originalFile?.originalName && (
                                <div className="file-meta">
                                    <span className="file-icon">📎</span>
                                    <span className="file-name">
                                        {resume.originalFile.originalName}
                                    </span>
                                    {resume.createdAt && (
                                        <span className="file-date">
                                            uploaded {formatDate(resume.createdAt)}
                                        </span>
                                    )}
                                </div>
                            )}

                            <button
                                className="delete-button"
                                onClick={() => setShowConfirm(true)}
                            >
                                Delete Resume
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Delete confirmation modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete Resume?</h3>
                        <p>This action can't be undone. You'll need to upload it again.</p>
                        <div className="modal-actions">
                            <button
                                className="modal-cancel"
                                onClick={() => setShowConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="modal-confirm"
                                onClick={handleDeleteConfirmed}
                            >
                                Delete
                            </button>
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
                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                                Bio
                            </label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={300}
                                rows={3}
                                placeholder="Tell us a little about yourself..."
                                style={{
                                    width: "100%",
                                    resize: "vertical",
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    border: "1px solid #dbe3ef",
                                    fontFamily: "inherit",
                                    fontSize: "13px",
                                }}
                            />
                        </div>

                        <div style={{ textAlign: "left", marginBottom: "6px" }}>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                                Phone number
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="e.g. +91 98765 43210"
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    border: "1px solid #dbe3ef",
                                    fontFamily: "inherit",
                                    fontSize: "13px",
                                }}
                            />
                        </div>
                     

                        {profileError && (
                            <div className="error-message" style={{ marginTop: "12px" }}>
                                <span>⚠</span>{profileError}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="modal-cancel"
                                onClick={() => setShowEditProfile(false)}
                                disabled={savingProfile}
                            >
                                Cancel
                            </button>
                            <button
                                className="modal-confirm"
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                            >
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
