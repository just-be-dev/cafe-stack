-- lazy.nvim project spec. LazyVim loads it on startup from this repo (lazy.nvim's `local_spec`,
-- on by default) once you have trusted it. Plain Neovim reads `.nvim.lua` instead.
--
-- Makes the workspace tsrs, patched with Effect diagnostics by `effect-tsgo patch --tsrs` on
-- install, the only TypeScript language server, so the editor reports what `mise run typecheck`
-- reports. Other TypeScript servers would run a checker without the Effect diagnostics.

local root = vim.fs.dirname(vim.fs.find(".lazy.lua", { upward = true, path = vim.uv.cwd() })[1])

return {
  {
    "neovim/nvim-lspconfig",
    opts = function(_, opts)
      opts.servers = opts.servers or {}
      for _, server in ipairs({ "tsc", "tsgo", "ts_ls", "tsserver", "vtsls" }) do
        opts.servers[server] = { enabled = false }
      end
      opts.servers.tsrs = {
        mason = false,
        cmd = { vim.fs.joinpath(root, "node_modules/.bin/tsrs"), "--lsp", "--stdio" },
        filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
        root_dir = function(bufnr, on_dir)
          local path = vim.api.nvim_buf_get_name(bufnr)
          if path == root or vim.startswith(path, root .. "/") then
            on_dir(root)
          end
        end,
      }
    end,
  },
}
