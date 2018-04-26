"""
    Created By : Elliot Francis
    Description : Sample Elixir/Phoenix Application Controller from a web based RFID Inventory System
    This controller backs the main page dashboard statistics as well as an System Status comparison
    report.
"""

defmodule ChemistryRfid.StatisticsController do
  use ChemistryRfid.Web, :controller
  alias ChemistryRfid.Organization, as: Organization
  alias ChemistryRfid.Location, as: Location
  alias ChemistryRfid.Asset, as: Asset
  alias ChemistryRfid.User, as: User
  alias ChemistryRfid.AssetAttribute, as: AssetAttribute
  alias ChemistryRfid.AssetHistory, as: AssetHistory

  @moduledoc """
  Login API Controller
  """

  def get_statistic(conn, params) do
    case params["key"] do
      "organization" ->
        case Organization.statistic(params["action"]) do
          {:ok, result} -> json conn, result
          {:error, reason} -> conn |> send_resp(500, reason)
        end
      "location" ->
        case Location.statistic(params["action"]) do
          {:ok, result} -> json conn, result
          {:error, reason} -> conn |> send_resp(500, reason)
        end

      "user" ->
        case User.statistic(params["action"]) do
          {:ok, result} -> json conn, result
          {:error, reason} -> conn |> send_resp(500, reason)
        end
      "asset" ->
        case params["action"] do
          "count" ->
            case Asset.statistic(params["action"]) do
              {:ok, result} -> json conn, result
              {:error, reason} -> conn |> send_resp(500, reason)
            end
          _ ->
            matches = Regex.named_captures(~r/(?<key>.*):(?<action>.*)/, params["action"])
            case AssetAttribute.statistic(matches["key"], matches["action"]) do
              {:ok, result} -> json conn, result
              {:error, reason} -> conn |> send_resp(500, reason)
            end
        end
      _ -> conn |> send_resp(404, "Statistics action #{params["key"]} not implemented")
    end
  end

  def get_frontpage_statistics(conn, _params) do
    {:ok, org_count} = Organization.statistic("count")
    {:ok, location_count} = Location.statistic("count")
    {:ok, asset_count} = Asset.statistic("count")
    {:ok, asset_value} = AssetAttribute.statistic("purchase_cost", "sum")
    {:ok, scan_count} = AssetHistory.statistic("scan")
    {:ok, update_count} = AssetHistory.statistic("update")
    {:ok, create_count} = AssetHistory.statistic("create")
    json conn, %{
      "org_count" => org_count,
      "location_count" => location_count,
      "asset_count" => asset_count,
      "asset_value" => asset_value,
      "scan_count" => scan_count,
      "update_count" => update_count,
      "create_count" => create_count
    }
  end

  def asset_compare(conn, params) do
    case Asset.get(:organization_code, params["value"]) do
      { :ok, assets } ->
        file = params["file"]
        comparisonIDs = Enum.map(File.stream!(file.path) |> CSV.decode, fn row ->
          case row do
            {:ok, rowdata} ->
              Enum.at(rowdata, 0)
            _ -> []
          end
        end)
        assetTags = Enum.map(assets, fn (asset) -> asset.asset_tag_number end )
        asset_list = Enum.map(assets, fn (asset) -> Asset.convertToMap(asset) end )
        comparison_matches = Enum.map(comparisonIDs, fn tag ->
          if Enum.member?(assetTags, tag) do
            %{ "match" => "both", "message" => "Registered", "asset"=> Enum.find(asset_list, fn(asset) -> asset["asset_tag_number"] == tag end) }
          else
            %{ "match" => "list", "message" => "Not registered", "asset" => %{ "asset_tag_number" => tag }}
          end
        end)
        system_matches = Enum.reduce(asset_list, [], fn(asset, acc) ->
          if not Enum.member?(comparisonIDs, asset["asset_tag_number"]) do
            Enum.concat(acc, [%{ "match" => "system", "asset" => asset, "message" => "Not in comparison list"}])
          else
            acc
          end
        end)
        json conn, Enum.concat(comparison_matches, system_matches)
      { :error, reason } -> conn |> send_resp(500, "Report Fetch Error -- #{reason}")
      _ -> conn |> send_resp(500, "Report Fetch Error -- Unknown Error")
    end
  end

end
