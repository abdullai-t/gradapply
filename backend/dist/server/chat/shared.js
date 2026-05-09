// @ts-nocheck
let cachedSchoolScopeSupport = null;
export async function chatSupportsSchoolScope() {
    if (cachedSchoolScopeSupport != null)
        return cachedSchoolScopeSupport;
    // MongoDB schema always includes `ChatMessage.schoolId` (no information_schema).
    cachedSchoolScopeSupport = true;
    return true;
}
export function buildSchoolScopeWhere(supportsSchoolScope, schoolId) {
    if (!supportsSchoolScope)
        return {};
    return schoolId ? { schoolId } : { schoolId: null };
}
export function reverseChronologicalToHistory(messages) {
    const history = [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        history.push({
            role: msg.role,
            content: msg.content,
        });
    }
    return history;
}
