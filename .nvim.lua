-- Neovim project config. Neovim runs it when 'exrc' is on (`vim.o.exrc = true` in your init.lua)
-- and you have trusted this file (`:trust`). LazyVim users get the same setup from `.lazy.lua`.
--
-- Makes the workspace tsrs, patched with Effect diagnostics by `effect-tsgo patch --tsrs` on
-- install, the only TypeScript language server, so the editor reports what `mise run typecheck`
-- reports. Other TypeScript servers would run a checker without the Effect diagnostics.

local root = vim.fs.dirname(vim.fs.abspath(debug.getinfo(1, "S").source:sub(2)))
local others = { "tsc", "tsgo", "ts_ls", "tsserver", "vtsls" }

local function in_root(path)
  return path ~= nil and (path == root or vim.startswith(path, root .. "/"))
end

vim.lsp.config("tsrs", {
  cmd = { vim.fs.joinpath(root, "node_modules/.bin/tsrs"), "--lsp", "--stdio" },
  filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
  root_dir = function(bufnr, on_dir)
    if in_root(vim.api.nvim_buf_get_name(bufnr)) then
      on_dir(root)
    end
  end,
})
vim.lsp.enable("tsrs")
vim.lsp.enable(others, false)

-- Plugins that enable servers after this file runs (mason-lspconfig, for one) can still start
-- another TypeScript server, so detach any that attach to a buffer in this repo.
vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("project-tsrs", { clear = true }),
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client and vim.list_contains(others, client.name) and in_root(vim.api.nvim_buf_get_name(args.buf)) then
      vim.schedule(function()
        vim.lsp.buf_detach_client(args.buf, client.id)
      end)
    end
  end,
})
