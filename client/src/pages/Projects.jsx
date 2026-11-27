import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import { Field } from '../components/Form.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatDate } from '../utils/ui.js';

export default function Projects() {
  const [projects, setProjects] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadProjects() {
    try {
      const { data } = await api.get('/projects');
      setProjects(data.data.projects);
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
      const { data } = await api.post('/projects', form);
      setProjects((current) => [data.data.project, ...(current || [])]);
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
    if (!window.confirm(`Delete "${project.name}" with its specifications and comparison history?`)) return;
    try {
      await api.delete(`/projects/${project.id}`);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      toast.success('Project deleted.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="wrap py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow">Workspaces</p>
          <h1 className="page-title mt-1.5">Projects</h1>
          <p className="mt-1.5 text-sm text-graphite">
            One baseline, one candidate and every comparison you run.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Cancel' : 'New project'}
        </button>
      </header>

      {showForm ? (
        <form className="sheet mt-5 p-4" onSubmit={handleCreate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="project-name"
              label="Name"
              required
              minLength={2}
              maxLength={80}
              placeholder="Acme Orders API"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <Field
              id="project-description"
              label="Description"
              maxLength={400}
              placeholder="Compatibility review for the v2 release"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={creating}>
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </form>
      ) : null}

      {projects === null ? (
        <Spinner label="loading projects" />
      ) : projects.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line px-5 py-10 text-center">
          <h2 className="h3">No projects yet</h2>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-6 text-graphite">
            Create a project, upload a baseline and a candidate specification, then keep the report as part of
            your review history.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {projects.map((project) => (
            <li key={project.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <Link to={`/projects/${project.id}`} className="text-sm font-medium text-ink hover:text-prussian">
                  {project.name}
                </Link>
                <p className="mt-0.5 line-clamp-1 text-[13px] leading-5 text-graphite">
                  {project.description || 'No description'}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted">created {formatDate(project.createdAt)}</p>
              </div>

              <div className="flex items-center gap-5">
                <Link to={`/projects/${project.id}`} className="text-[13px] font-medium text-prussian hover:text-ink">
                  Open
                </Link>
                <button
                  type="button"
                  className="text-[13px] text-muted transition-colors hover:text-rust"
                  onClick={() => handleDelete(project)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
