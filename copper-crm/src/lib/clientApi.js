import { apiGet, apiPost, apiPut, apiDelete } from "./api.js";
import { storeGet, storeSave, storeRemove } from "./store.js";

function withFallback(apiFn, fallbackFn) {
  return apiFn().catch(fallbackFn);
}

export const clientApi = {
  getProfile: (token) => withFallback(
    () => apiGet("/api/client/profile", token),
    () => {
      const stored = storeGet("profile");
      return stored[0] || null;
    }
  ),

  updateProfile: (body, token) => withFallback(
    () => apiPut("/api/client/profile", body, token),
    () => {
      storeSave("profile", { ...body, id: "demo-client-profile", _id: "demo-client-profile" });
      return body;
    }
  ),

  changePassword: (body, token) => withFallback(
    () => apiPut("/api/client/change-password", body, token),
    () => ({ success: true, message: "Password updated locally." })
  ),

  getOrders: (token) => withFallback(
    () => apiGet("/api/client/orders", token),
    () => storeGet("orders")
  ),

  getProjects: (token) => withFallback(
    () => apiGet("/api/client/projects", token),
    () => storeGet("projects").map(p => ({
      ...p,
      status: p.clientStatus || "in_progress",
    }))
  ),

  getProjectTasks: (projectId, token) => withFallback(
    () => apiGet(`/api/client/projects/${projectId}/tasks`, token),
    () => []
  ),

  getDocuments: (token) => withFallback(
    () => apiGet("/api/client/documents", token),
    () => storeGet("projects").flatMap(p =>
      (p.documents || [])
        .filter(d => d.category !== "Internal")
        .map(d => ({
          ...d,
          _id: d._id || `doc-${p.id}-${d.name}`,
          projectName: p.name,
          projectId: p.id,
          fileUrl: d.fileUrl || null,
        }))
    )
  ),

  getMeetings: (token) => withFallback(
    () => apiGet("/api/client/meetings", token),
    () => storeGet("meetings")
  ),

  requestMeeting: (body, token) => withFallback(
    () => apiPost("/api/client/meetings", body, token),
    () => storeSave("meetings", {
      ...body,
      _id: `mtg-${Date.now()}`,
      status: "requested",
      createdAt: new Date().toISOString(),
    })
  ),
};

export const adminApi = {
  getClients: (token) => withFallback(
    () => apiGet("/api/admin/clients", token),
    () => storeGet("contacts")
  ),

  getClientDetail: (id, token) => withFallback(
    () => apiGet(`/api/admin/clients/${id}`, token),
    () => storeGet("contacts").find(c => String(c.id || c._id) === String(id)) || null
  ),

  getProjects: (token) => withFallback(
    () => apiGet("/api/admin/projects", token),
    () => storeGet("projects")
  ),

  createProject: (body, token) => withFallback(
    () => apiPost("/api/admin/projects", body, token),
    () => storeSave("projects", { ...body, id: `proj-${Date.now()}` })
  ),

  updateProject: (id, body, token) => withFallback(
    () => apiPut(`/api/admin/projects/${id}`, body, token),
    () => storeSave("projects", { ...body, _id: id, id })
  ),

  deleteProject: (id, token) => withFallback(
    () => apiDelete(`/api/admin/projects/${id}`, token),
    () => { storeRemove("projects", id); return {}; }
  ),

  getDocuments: (token) => withFallback(
    () => apiGet("/api/admin/documents", token),
    () => storeGet("projects").flatMap(p =>
      (p.documents || []).map(d => ({ ...d, projectName: p.name, projectId: p.id || p._id }))
    )
  ),

  createDocument: (body, token) => withFallback(
    () => apiPost("/api/admin/documents", body, token),
    () => {
      const projects = storeGet("projects");
      const proj = projects.find(p => String(p.id || p._id) === String(body.projectId));
      if (proj) {
        const doc = { ...body, _id: `doc-${Date.now()}`, date: new Date().toLocaleDateString("en-IN") };
        storeSave("projects", { ...proj, documents: [...(proj.documents || []), doc] });
        return doc;
      }
      return body;
    }
  ),

  updateDocument: (id, body, token) => withFallback(
    () => apiPut(`/api/admin/documents/${id}`, body, token),
    () => body
  ),

  deleteDocument: (id, token) => withFallback(
    () => apiDelete(`/api/admin/documents/${id}`, token),
    () => ({})
  ),

  getMeetings: (token) => withFallback(
    () => apiGet("/api/admin/meetings", token),
    () => storeGet("meetings")
  ),

  updateMeeting: (id, body, token) => withFallback(
    () => apiPut(`/api/admin/meetings/${id}`, body, token),
    () => storeSave("meetings", { ...body, _id: id })
  ),
};
