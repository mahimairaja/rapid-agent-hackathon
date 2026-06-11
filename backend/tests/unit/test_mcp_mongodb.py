"""Unit tests for the MongoDB MCP client helpers (F8).

The stdio session lifecycle is exercised by the live smoke; these tests cover
the pure seams: command resolution and tool-output parsing.
"""

from src.services.mcp_mongodb import parse_tool_text, server_command


def test_server_command_prefers_path_binary(monkeypatch):
    monkeypatch.setattr(
        "src.services.mcp_mongodb.shutil.which",
        lambda name: "/usr/local/bin/mongodb-mcp-server",
    )
    assert server_command() == ["mongodb-mcp-server"]


def test_server_command_falls_back_to_npx(monkeypatch):
    monkeypatch.setattr("src.services.mcp_mongodb.shutil.which", lambda name: None)
    assert server_command() == ["npx", "-y", "mongodb-mcp-server"]


def test_parse_tool_text_json_array():
    docs = parse_tool_text(['[{"a": 1}, {"b": 2}]'])
    assert docs == [{"a": 1}, {"b": 2}]


def test_parse_tool_text_single_object_and_multiple_items():
    docs = parse_tool_text(['{"a": 1}', '{"b": 2}'])
    assert docs == [{"a": 1}, {"b": 2}]


def test_parse_tool_text_ndjson_with_junk():
    text = 'Found 2 documents:\n{"a": 1}\nnot json\n{"b": 2}\n'
    assert parse_tool_text([text]) == [{"a": 1}, {"b": 2}]


def test_parse_tool_text_empty_and_blank():
    assert parse_tool_text([]) == []
    assert parse_tool_text(["", "   "]) == []
