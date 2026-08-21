import api from "./api";

export const getAllResumes = async () => {
    const response = await api.get("/admin/resumes");
    return response.data;
};

export const getResumeById = async (id) => {
    const response = await api.get(`/admin/resumes/${id}`);
    return response.data;
};

export const deleteResume = async (id) => {
    const response = await api.delete(`/admin/resumes/${id}`);
    return response.data;
};

export const getAllUsers = async () => {
    const response = await api.get("/admin/users");
    return response.data;
};

export const deleteUser = async (id) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
};

export const getAdminStats = async () => {
    const response = await api.get("/admin/stats");
    return response.data;
};