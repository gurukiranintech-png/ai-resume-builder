import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllResumes, deleteResume } from "../services/adminService";
import api from "../services/api";
import "./AdminDashboard.css";

const API_ORIGIN = api.defaults.baseURL.replace(/\/api\/?$/, "");

function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function AdminDashboard() {
    const navigate = useNavigate();

    const [admin, setAdmin] = useState(null);
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedResume, setSelectedResume] = useState(null);
    const [search, setSearch] = useState("");
    const [resumeToDelete, setResumeToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        const token = localStorage.getItem("token");

        if (!token || !storedUser) {
            navigate("/login");
            return;
        }

        const parsedUser = JSON.parse(storedUser);

        if (parsedUser.role !== "admin") {
            navigate("/dashboard");
            return;
        }

        setAdmin(parsedUser);
        fetchResumes();
    }, []);

    const fetchResumes = async () => {
        try {
            const data = await getAllResumes();
            if (data.success) {
                setResumes(data.resumes);
            }
        } catch (error) {
            console.error("Failed to fetch resumes:", error);
            setError(error.response?.data?.message || "Failed to load resumes");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
    };

    const handleConfirmDelete = async () => {
        if (!resumeToDelete) return;

        setDeleting(true);
        try {
            await deleteResume(resumeToDelete._id);
            setResumes((prev) => prev.filter((r) => r._id !== resumeToDelete._id));

            if (selectedResume?._id === resumeToDelete._id) {
                setSelectedResume(null);
            }
            setResumeToDelete(null);
        } catch (error) {
            console.error("Failed to delete resume:", error);
            setError(error.response?.data?.message || "Failed to delete resume");
        } finally {
            setDeleting(false);
        }
    };

    const filteredResumes = resumes.filter((r) => {
        const name = r.user?.name?.toLowerCase() || "";
        const email = r.user?.email?.toLowerCase() || "";
        const query = search.toLowerCase();
        return name.includes(query) || email.includes(query);
    });

    if (loading) {
        return (
            <div className="admin-page">
                <div className="dashboard-loading">Loading...</div>
            </div>
        );
    }

    const adminPictureUrl = admin?.profilePicture ? `${API_ORIGIN}${admin.profilePicture}` : null;

    return (
        <div className="admin-page">
            <div className="background-circle circle-one"></div>
            <div className="background-circle circle-two"></div>

            <div className="admin-container">

                {/* Top bar */}
                <div className="dashboard-topbar">
                    <div className="dashboard-brand">
                        <div className="brand-logo">
                            <span>R</span>
                            <div className="ai-badge">AI</div>
                        </div>
                        <div>
                            <h1>AI Resume Builder</h1>
                            <p>Admin Dashboard</p>
                        </div>
                    </div>

                    <button className="logout-button" onClick={handleLogout}>
                        Logout
                    </button>
                </div>

                {/* Admin profile */}
                {admin && (
                    <div className="profile-card">
                        <div
                            className="profile-avatar admin-avatar"
                            style={adminPictureUrl ? { padding: 0, overflow: "hidden" } : undefined}
                        >
                            {adminPictureUrl ? (
                                <img
                                    src={adminPictureUrl}
                                    alt={admin.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                                />
                            ) : (
                                admin.name?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h2>{admin.name}</h2>
                            <p>{admin.email}</p>
                            {admin.bio && <p style={{ margin: "2px 0 6px" }}>{admin.bio}</p>}
                            <span className="role-badge admin-badge">admin</span>
                        </div>
                        <div className="stat-block">
                            <span className="stat-number">{resumes.length}</span>
                            <span className="stat-label">Resumes Submitted</span>
                        </div>
                    </div>
                )}

                {error && <div className="error-message"><span>⚠</span>{error}</div>}

                {/* Resume list */}
                <div className="admin-list-card">
                    <div className="admin-list-header">
                        <h2>Submitted Resumes</h2>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    {filteredResumes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p>No resumes found.</p>
                        </div>
                    ) : (
                        <div className="resume-list">
                            {filteredResumes.map((resume) => {
                                const rowPictureUrl = resume.user?.profilePicture
                                    ? `${API_ORIGIN}${resume.user.profilePicture}`
                                    : null;

                                return (
                                    <div className="resume-row" key={resume._id}>
                                        <div
                                            className="resume-row-avatar"
                                            style={rowPictureUrl ? { padding: 0, overflow: "hidden" } : undefined}
                                        >
                                            {rowPictureUrl ? (
                                                <img
                                                    src={rowPictureUrl}
                                                    alt={resume.user?.name}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                                                />
                                            ) : (
                                                resume.user?.name?.charAt(0).toUpperCase() || "?"
                                            )}
                                        </div>

                                        <div className="resume-row-info">
                                            <strong>{resume.user?.name || "Unknown"}</strong>
                                            <span>{resume.user?.email}</span>
                                        </div>

                                        <div className="resume-row-meta">
                                            <span className="file-name">
                                                {resume.originalFile?.originalName || "resume"}
                                            </span>
                                            <span className="file-date">
                                                {formatDate(resume.createdAt)}
                                            </span>
                                        </div>

                                        <div className="resume-row-actions">
                                            <button
                                                className="view-button"
                                                onClick={() => setSelectedResume(resume)}
                                            >
                                                View →
                                            </button>
                                            <button
                                                className="delete-button"
                                                title="Delete resume"
                                                aria-label="Delete resume"
                                                onClick={() => setResumeToDelete(resume)}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail modal */}
            {selectedResume && (
                <div className="modal-overlay" onClick={() => setSelectedResume(null)}>
                    <div className="detail-modal" onClick={(e) => e.stopPropagation()}>

                        <div className="detail-modal-header">
                            {selectedResume.user?.profilePicture && (
                                <img
                                    src={`${API_ORIGIN}${selectedResume.user.profilePicture}`}
                                    alt={selectedResume.user?.name}
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        marginRight: "12px",
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                            <div>
                                <h2>{selectedResume.user?.name}</h2>
                                <p>{selectedResume.user?.email}</p>
                                {selectedResume.user?.bio && (
                                    <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                                        {selectedResume.user.bio}
                                    </p>
                                )}
                                {selectedResume.user?.phone && (
                                    <p style={{ margin: "2px 0 0", fontSize: "13px" }}>
                                        {selectedResume.user.phone}
                                    </p>
                                )}
                            </div>
                            <div className="detail-modal-header-actions">
                                <button
                                    className="delete-button"
                                    title="Delete resume"
                                    aria-label="Delete resume"
                                    onClick={() => setResumeToDelete(selectedResume)}
                                >
                                    🗑
                                </button>
                                <button
                                    className="close-button"
                                    onClick={() => setSelectedResume(null)}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="detail-modal-body">

                            {selectedResume.personalInfo && (
                                <div className="resume-section">
                                    <h3>Personal Info</h3>
                                    <div className="info-grid">
                                        {selectedResume.personalInfo.name && (
                                            <span>{selectedResume.personalInfo.name}</span>
                                        )}
                                        {selectedResume.personalInfo.phone && (
                                            <span>{selectedResume.personalInfo.phone}</span>
                                        )}
                                        {selectedResume.personalInfo.location && (
                                            <span>{selectedResume.personalInfo.location}</span>
                                        )}
                                        {selectedResume.personalInfo.github && (
                                            <span>{selectedResume.personalInfo.github}</span>
                                        )}
                                        {selectedResume.personalInfo.linkedin && (
                                            <span>{selectedResume.personalInfo.linkedin}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedResume.summary && (
                                <div className="resume-section summary-highlight">
                                    <h3>AI Summary</h3>
                                    <p>{selectedResume.summary}</p>
                                </div>
                            )}

                            {selectedResume.skills?.length > 0 && (
                                <div className="resume-section">
                                    <h3>Skills</h3>
                                    <div className="tag-list">
                                        {selectedResume.skills.map((skill, i) => (
                                            <span className="tag" key={i}>{skill}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedResume.experience?.length > 0 && (
                                <div className="resume-section">
                                    <h3>Experience</h3>
                                    {selectedResume.experience.map((exp, i) => (
                                        <div className="entry" key={i}>
                                            <strong>{exp.title || exp.role}</strong>
                                            {exp.company && <span> · {exp.company}</span>}
                                            {exp.description && <p>{exp.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedResume.projects?.length > 0 && (
                                <div className="resume-section">
                                    <h3>Projects</h3>
                                    {selectedResume.projects.map((proj, i) => (
                                        <div className="entry" key={i}>
                                            <strong>{proj.title || proj.name}</strong>
                                            {proj.description && <p>{proj.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedResume.education?.length > 0 && (
                                <div className="resume-section">
                                    <h3>Education</h3>
                                    {selectedResume.education.map((edu, i) => (
                                        <div className="entry" key={i}>
                                            <strong>{edu.degree || edu.institution}</strong>
                                            {edu.institution && edu.degree && (
                                                <span> · {edu.institution}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedResume.certifications?.length > 0 && (
                                <div className="resume-section">
                                    <h3>Certifications</h3>
                                    <div className="tag-list">
                                        {selectedResume.certifications.map((cert, i) => (
                                            <span className="tag" key={i}>{cert}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedResume.awards?.length > 0 && (
                                <div className="resume-section">
                                    <h3>Awards</h3>
                                    <div className="tag-list">
                                        {selectedResume.awards.map((award, i) => (
                                            <span className="tag" key={i}>{award}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="resume-section file-info-section">
                                <h3>File</h3>
                                <div className="file-meta">
                                    <span className="file-icon">📎</span>
                                    <span className="file-name">
                                        {selectedResume.originalFile?.originalName}
                                    </span>
                                    <span className="file-date">
                                        uploaded {formatDate(selectedResume.createdAt)}
                                    </span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {resumeToDelete && (
                <div className="confirm-overlay" onClick={() => !deleting && setResumeToDelete(null)}>
                    <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete this resume?</h3>
                        <p>
                            This will permanently remove{" "}
                            <strong>{resumeToDelete.user?.name || "this"}</strong>'s submitted
                            resume. This action can't be undone.
                        </p>
                        <div className="confirm-dialog-actions">
                            <button
                                className="confirm-cancel"
                                onClick={() => setResumeToDelete(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-delete"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;