import api from "./api";

export const getAllResumes = async () => {
    const response = await api.get("/admin/resumes");
    return response.data;
};

export const deleteResume = async (id) => {
    const response = await api.delete(`/admin/resumes/${id}`);
    return response.data;
};