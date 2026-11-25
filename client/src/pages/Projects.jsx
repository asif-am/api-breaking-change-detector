import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import { formatDate } from '../utils/ui.js';

export default function Projects() {
  const [projects, setProjects] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadProjects() {
    try {
      const response = await api.get('/projects');
      setProjects(response.data.data.projects);
    } catch (error) {
      if (error?.response?.status === 401) return;
      toast.error(errorMessage(error));
      setProjects([]);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await api.post('/projects', {
        name: form.name,
        description: form.description,
      });
      const project = response.data.data.project;
      setProjects((current) => [project, ...(current || [])]);
      setForm({ name: '', description: '' });
      setShowForm(false);
      toast.success('Project created.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(project) {
    const confirmed = window.confirm(
      `Delete "${project.name}" with its specifications and comparison history?`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/projects/${project.id}`);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      toast.success('Project deleted.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your workspaces</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Each project keeps one baseline, one candidate and every comparison you run.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Cancel' : 'New project'}
        </button>
      </div>

      {showForm ? (
        <form className="card mt-5 p-4" onSubmit={handleCreate}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="project-name">
                Project name
              </label>
              <input
                id="project-name"
                className="input"
                required
                minLength={2}
                maxLength={80}
                placeholder="Acme Orders API"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="project-description">
                Description (optional)
              </label>
              <input
                id="project-description"
                className="input"
                maxLength={400}
                placeholder="Compatibility review for the v2 release"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-3" disabled={creating}>
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </form>
      ) : null}

      {projects === null ? (
        <Spinner label="Loading projects…" />
      ) : projects.length === 0 ? (
        <div className="card mt-6 p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">No projects yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Create a project, upload a baseline and a candidate specification, then store the comparison report
            as part of your review history.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <article key={project.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{project.name}</h2>
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600 hover:text-rose-700"
                  onClick={() => handleDelete(project)}
                >
                  Delete
                </button>
              </div>
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-600">
                {project.description || 'No description provided.'}
              </p>
              <p className="mt-3 text-[11px] text-slate-500">Created {formatDate(project.createdAt)}</p>
              <Link to={`/projects/${project.id}`} className="btn-secondary mt-3">
                Open project
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
